// Unica porta verso i modelli (OpenRouter). Ogni chiamata ha un tetto di token in uscita,
// passa dal tetto di spesa giornaliero e viene registrata in model_calls.

// Modello per agente: si cambia qui e basta.
export const MODELS: Record<string, string> = {
  cartografo: "openai/gpt-6-luna",
  default: "openai/gpt-6-luna",
  // blocco 2: unica eccezione a Luna, solo per trascrivere la lezione registrata (decisione di Luca delle 13:15)
  trascrittore: "google/gemini-3.8-flash",
};

// Dollari per milione di token (ingresso, uscita), catalogo OpenRouter letto il 14/11/2026.
// Serve solo se OpenRouter non restituisce il costo della chiamata.
const PRICES: Record<string, [number, number]> = {
  "openai/gpt-6-luna": [0.1, 0.5],
  // blocco 2
  "google/gemini-3.8-flash": [0.825, 4.125],
};

export type Message = { role: "system" | "user" | "assistant"; content: string | ContentPart[] };
// blocco 2: audio in ingresso per la trascrizione (formato OpenRouter input_audio).
export type ContentPart = { type: "text"; text: string } | { type: "input_audio"; input_audio: { data: string; format: "wav" } };
// Caratteri equivalenti per la stima del costo: l'audio WAV a 16 kHz vale circa 32 token al secondo,
// cioè un token ogni ~1.330 caratteri di base64; qui un «carattere» ogni 400, con margine.
const contentChars = (c: Message["content"]) =>
  typeof c === "string" ? c.length : c.reduce((n, p) => n + (p.type === "text" ? p.text.length : Math.ceil(p.input_audio.data.length / 400)), 0);
// fine blocco 2

export type CompleteOptions = {
  agent: string;
  messages: Message[];
  maxTokens: number;
  ref?: string;
  // Schema JSON per l'uscita strutturata; senza schema la risposta è testo libero.
  jsonSchema?: { name: string; schema: Record<string, unknown> };
  // fase 03: facoltativo, chi non lo passa non cambia comportamento. Se presente la risposta arriva in streaming: riceve il testo accumulato finora.
  onText?: (textSoFar: string) => void;
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
  if (!env.OPENROUTER_API_KEY) throw new LlmError("config", "Model key not configured on the server.");
  const model = MODELS[opts.agent] ?? MODELS.default;
  const [pin, pout] = PRICES[model] ?? [0.1, 0.5];
  const promptChars = opts.messages.reduce((n, m) => n + contentChars(m.content), 0); // blocco 2: contentChars
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
    throw new LlmError("budget", `Today's spending cap reached ($${budget.toFixed(2)}). Try again tomorrow or raise DAILY_BUDGET_USD.`);
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
  if (opts.onText) body.stream = true;
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
    throw new LlmError("upstream", "The model did not respond in time.", true);
  }
  if (!res.ok) {
    await settle(0, 0, 0);
    const detail = (await res.text()).slice(0, 300);
    throw new LlmError("upstream", `The model did not respond (${res.status}): ${detail}`, res.status === 429 || res.status >= 500);
  }
  let data: CompletionData;
  if (opts.onText) {
    // fase 03: uno stream interrotto (rete, timeout) vale come errore transitorio.
    try {
      data = await readStream(res, opts.onText);
    } catch (err) {
      await settle(0, 0, 0);
      throw err instanceof LlmError ? err : new LlmError("upstream", "The streaming response was interrupted.", true);
    }
  } else data = (await res.json()) as CompletionData;

  const promptTokens = data.usage?.prompt_tokens ?? 0;
  const completionTokens = data.usage?.completion_tokens ?? 0;
  const cost = data.usage?.cost ?? (promptTokens * pin + completionTokens * pout) / 1_000_000;
  await settle(promptTokens, completionTokens, cost);

  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new LlmError("upstream", "The model returned an empty response.", true);
  if (opts.jsonSchema) {
    try {
      JSON.parse(content);
    } catch {
      throw new LlmError("invalid_json", "The model returned invalid JSON.", true);
    }
  }
  return content;
}

// fase 03: lettura dello streaming SSE di OpenRouter, con l'uso dei token nell'ultimo blocco.
type CompletionData = {
  choices?: { message?: { content?: string } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
};

async function readStream(res: Response, onText: (textSoFar: string) => void): Promise<CompletionData> {
  if (!res.body) throw new LlmError("upstream", "The model did not return a stream.");
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let text = "";
  let usage: CompletionData["usage"];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += value;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const chunk = JSON.parse(payload) as {
          choices?: { delta?: { content?: string } }[];
          usage?: CompletionData["usage"];
          error?: { message?: string };
        };
        if (chunk.error) throw new LlmError("upstream", `The model stopped: ${chunk.error.message ?? "error"}`);
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) {
          text += delta;
          onText(text);
        }
        if (chunk.usage) usage = chunk.usage;
      } catch (err) {
        if (err instanceof LlmError) throw err;
      }
    }
  }
  return { choices: [{ message: { content: text } }], usage };
}
