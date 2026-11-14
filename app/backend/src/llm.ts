// Unica porta verso i modelli (OpenRouter). Ogni chiamata ha un tetto di token in uscita,
// passa dal tetto di spesa giornaliero e viene registrata in model_calls.

// Modello per agente: si cambia qui e basta.
export const MODELS: Record<string, string> = {
  cartografo: "openai/gpt-6-luna",
  default: "openai/gpt-6-luna",
};

// Dollari per milione di token (ingresso, uscita), catalogo OpenRouter letto il 14/11/2026.
// Serve solo se OpenRouter non restituisce il costo della chiamata.
const PRICES: Record<string, [number, number]> = {
  "openai/gpt-6-luna": [0.1, 0.5],
};

export type Message = { role: "system" | "user" | "assistant"; content: string };

export type CompleteOptions = {
  agent: string;
  messages: Message[];
  maxTokens: number;
  ref?: string;
  // Schema JSON per l'uscita strutturata; senza schema la risposta è testo libero.
  jsonSchema?: { name: string; schema: Record<string, unknown> };
};

export class LlmError extends Error {
  constructor(
    public code: "budget" | "upstream" | "config" | "invalid_json",
    message: string,
    public retryable = false,
  ) {
    super(message);
  }
}

export async function spentToday(db: D1Database): Promise<number> {
  const row = await db
    .prepare("SELECT COALESCE(SUM(cost_usd), 0) AS total FROM model_calls WHERE created_at >= date('now')")
    .first<{ total: number }>();
  return row?.total ?? 0;
}

export function dailyBudget(env: Env): number {
  const v = Number(env.DAILY_BUDGET_USD);
  return Number.isFinite(v) && v > 0 ? v : 1.5;
}

// Una chiamata: prenota il costo massimo, chiama, riconcilia. Un solo nuovo tentativo su errore
// transitorio (rete, timeout, 429, 5xx) o, con jsonSchema, su JSON non valido.
export async function complete(env: Env, opts: CompleteOptions): Promise<string> {
  try {
    return await attempt(env, opts);
  } catch (err) {
    if (err instanceof LlmError && err.retryable) return attempt(env, opts);
    throw err;
  }
}

const TIMEOUT_MS = 90_000;

async function attempt(env: Env, opts: CompleteOptions): Promise<string> {
  if (!env.OPENROUTER_API_KEY) throw new LlmError("config", "Chiave dei modelli non configurata sul server.");
  const model = MODELS[opts.agent] ?? MODELS.default;
  const [pin, pout] = PRICES[model] ?? [0.1, 0.5];
  const promptChars = opts.messages.reduce((n, m) => n + m.content.length, 0);
  // Stima prudente: 1 token ogni 3 caratteri in ingresso, tutto max_tokens in uscita.
  const maxCost = ((promptChars / 3) * pin + opts.maxTokens * pout) / 1_000_000;
  const budget = dailyBudget(env);

  // Prenotazione atomica: la riga entra solo se il totale di oggi più il costo massimo sta sotto il tetto.
  const reserved = await env.DB.prepare(
    `INSERT INTO model_calls (agent, model, cost_usd, ref)
     SELECT ?1, ?2, ?3, ?4
     WHERE (SELECT COALESCE(SUM(cost_usd), 0) FROM model_calls WHERE created_at >= date('now')) + ?3 <= ?5
     RETURNING id`,
  )
    .bind(opts.agent, model, maxCost, opts.ref ?? null, budget)
    .first<{ id: number }>();
  if (!reserved) {
    throw new LlmError("budget", `Tetto di spesa di oggi raggiunto (${budget.toFixed(2)} $). Riprova domani o alza DAILY_BUDGET_USD.`);
  }
  const settle = (promptTokens: number, completionTokens: number, cost: number) =>
    env.DB.prepare("UPDATE model_calls SET prompt_tokens = ?, completion_tokens = ?, cost_usd = ? WHERE id = ?")
      .bind(promptTokens, completionTokens, cost, reserved.id)
      .run();

  const body: Record<string, unknown> = {
    model,
    messages: opts.messages,
    max_tokens: opts.maxTokens,
    reasoning: { effort: "low" },
    usage: { include: true },
  };
  if (opts.jsonSchema) {
    body.response_format = {
      type: "json_schema",
      json_schema: { name: opts.jsonSchema.name, strict: true, schema: opts.jsonSchema.schema },
    };
  }

  let res: Response;
  try {
    res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        "content-type": "application/json",
        "x-title": "PRISMA",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    await settle(0, 0, 0);
    throw new LlmError("upstream", "Il modello non ha risposto in tempo.", true);
  }
  if (!res.ok) {
    await settle(0, 0, 0);
    const detail = (await res.text()).slice(0, 300);
    throw new LlmError("upstream", `Il modello non ha risposto (${res.status}): ${detail}`, res.status === 429 || res.status >= 500);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
  };

  const promptTokens = data.usage?.prompt_tokens ?? 0;
  const completionTokens = data.usage?.completion_tokens ?? 0;
  const cost = data.usage?.cost ?? (promptTokens * pin + completionTokens * pout) / 1_000_000;
  await settle(promptTokens, completionTokens, cost);

  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new LlmError("upstream", "Il modello ha restituito una risposta vuota.", true);
  if (opts.jsonSchema) {
    try {
      JSON.parse(content);
    } catch {
      throw new LlmError("invalid_json", "Il modello ha restituito un JSON non valido.", true);
    }
  }
  return content;
}
