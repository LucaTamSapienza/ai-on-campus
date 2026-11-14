// study plan page: il PDF del piano, generato nel browser con @react-pdf/renderer (testo vero e
// selezionabile, A4). Si carica solo al clic su «Download PDF». I colori arrivano dai token di
// globals.css letti a runtime; le misure in punti tipografici stanno tutte in PT.
import { Document, Font, Image, Page, pdf, StyleSheet, Text, View } from "@react-pdf/renderer";
import { BRAND_FILES, DOC_TEXT, type PlanDocumentData } from "./plan-document-shared";

type Palette = { foreground: string; muted: string; mutedForeground: string; border: string; primary: string; card: string };

// Font del design system (Plus Jakarta Sans) con le riserve per greco e simboli matematici
// dei nomi dei concetti (ε, π, ℝ, ≤): file OFL in public/fonts.
let fontsReady = false;
function registerFonts(origin: string) {
  if (fontsReady) return;
  Font.register({
    family: "Jakarta",
    fonts: [400, 600, 700].map((w) => ({ src: `${origin}/fonts/jakarta-${w}.ttf`, fontWeight: w })),
  });
  Font.register({
    family: "NotoGreek",
    fonts: [400, 700].map((w) => ({ src: `${origin}/fonts/noto-greek-${w}.ttf`, fontWeight: w })),
  });
  Font.register({ family: "NotoMath", src: `${origin}/fonts/noto-math-latin-400.ttf` });
  // Niente sillabazione automatica: i nomi dei concetti non si spezzano.
  Font.registerHyphenationCallback((word) => [word]);
  fontsReady = true;
}

const FONT = ["Jakarta", "NotoGreek", "NotoMath"];
const MONO = ["Courier", "NotoMath"];

// Scala in punti, ricalcata sulla scala del design system (12/14/16/18/24/32 px) per una pagina A4.
// Interlinea come multiplo: va sempre accanto a un fontSize esplicito, altrimenti react-pdf
// la moltiplica per la sua dimensione predefinita (18 pt).
const LEADING = 1.45;
const PT = { xs: 8, sm: 9, base: 10.5, lg: 12.5, title: 22, pageX: 48, pageTop: 84, pageBottom: 60, gap: 4, block: 14, radius: 6, rule: 0.75, markSize: 22, replyHeight: 16 };

function makeStyles(c: Palette) {
  return StyleSheet.create({
    page: { paddingTop: PT.pageTop, paddingBottom: PT.pageBottom, paddingHorizontal: PT.pageX, fontFamily: FONT, fontSize: PT.base, color: c.foreground, backgroundColor: c.card },
    header: { position: "absolute", top: PT.block * 2, left: PT.pageX, right: PT.pageX, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: PT.gap * 2 },
    brand: { flexDirection: "row", alignItems: "center", gap: PT.gap * 2 },
    mark: { width: PT.markSize, height: PT.markSize },
    wordmark: { fontSize: PT.lg, fontWeight: 700, letterSpacing: 1.5 },
    reply: { height: PT.replyHeight, width: (PT.replyHeight * 565) / 150 },
    footer: { position: "absolute", bottom: PT.block * 1.5, left: PT.pageX, right: PT.pageX, paddingTop: PT.gap * 2, fontSize: PT.xs, color: c.mutedForeground },
    pageNumber: { position: "absolute", bottom: PT.block * 1.5, right: PT.pageX, paddingTop: PT.gap * 2, fontSize: PT.xs, color: c.mutedForeground },
    title: { fontSize: PT.title, fontWeight: 700, lineHeight: 1.2 },
    course: { fontSize: PT.lg, color: c.mutedForeground, marginTop: PT.gap },
    meta: { flexDirection: "row", flexWrap: "wrap", paddingVertical: PT.gap * 2 },
    metaItem: { width: "33.33%", paddingVertical: PT.gap },
    metaLabel: { fontSize: PT.xs, color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.6 },
    metaValue: { fontSize: PT.base, fontWeight: 600 },
    known: { marginTop: PT.block },
    body: { fontSize: PT.base, lineHeight: LEADING },
    glance: { marginTop: PT.block * 1.5 },
    glanceRow: { flexDirection: "row", paddingVertical: PT.gap },
    glanceTitle: { width: "34%", fontSize: PT.sm, fontWeight: 600 },
    glanceCount: { width: "20%", fontSize: PT.sm, color: c.mutedForeground },
    glanceLessons: { flex: 1, fontSize: PT.sm, color: c.mutedForeground },
    label: { fontSize: PT.sm, fontWeight: 600, color: c.mutedForeground, marginBottom: PT.gap },
    session: { marginTop: PT.block * 1.5 },
    sessionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: PT.gap * 2 },
    sessionTitle: { fontSize: PT.lg, fontWeight: 700 },
    count: { fontSize: PT.sm, color: c.mutedForeground },
    concepts: { flexDirection: "row", flexWrap: "wrap", marginBottom: PT.gap * 2 },
    concept: { width: "50%", flexDirection: "row", paddingRight: PT.gap * 2, paddingVertical: 1 },
    conceptNum: { width: PT.block * 1.4, color: c.mutedForeground, fontSize: PT.sm },
    conceptName: { flex: 1, fontSize: PT.sm, lineHeight: LEADING },
    lesson: { fontFamily: MONO, fontSize: PT.xs, color: c.mutedForeground },
    noEvidence: { fontSize: PT.xs, color: c.mutedForeground },
    why: { marginBottom: PT.gap * 2, fontSize: PT.base, lineHeight: LEADING },
    lookItem: { flexDirection: "row", marginBottom: PT.gap },
    ref: { width: PT.block * 7, fontFamily: MONO, fontSize: PT.sm, fontWeight: 700, color: c.primary },
    note: { flex: 1, fontSize: PT.sm, lineHeight: LEADING },
    hint: { fontSize: PT.sm, color: c.mutedForeground, lineHeight: LEADING },
    boundary: { marginTop: PT.block * 2, padding: PT.block, borderRadius: PT.radius, backgroundColor: c.muted },
    boundaryTitle: { fontWeight: 700, marginBottom: PT.gap },
    rule: { height: PT.rule, backgroundColor: c.border },
    ruleAbsolute: { position: "absolute", left: 0, right: 0, height: PT.rule, backgroundColor: c.border },
  });
}

function PlanPdf({ data, palette, origin }: { data: PlanDocumentData; palette: Palette; origin: string }) {
  const s = makeStyles(palette);
  return (
    <Document title={`${DOC_TEXT.title} · ${data.courseName}`} author="Prisma" creator="Prisma" producer="Prisma" language="en">
      <Page size="A4" style={s.page}>
        <View style={s.header} fixed>
          <View style={s.brand}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- Image di react-pdf, non un <img> */}
            <Image style={s.mark} src={`${origin}${BRAND_FILES.prismaMarkPng}`} />
            <Text style={s.wordmark}>{DOC_TEXT.wordmark}</Text>
          </View>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- Image di react-pdf, non un <img> */}
          <Image style={s.reply} src={`${origin}${BRAND_FILES.replyLogo}`} />
          <View style={[s.ruleAbsolute, { bottom: 0 }]} />
        </View>
        <View style={s.footer} fixed>
          <Text>{DOC_TEXT.footer}</Text>
          <View style={[s.ruleAbsolute, { top: 0 }]} />
        </View>
        {/* Numero di pagina: testo assoluto. Un <Text render> sotto un antenato con lineHeight manda in errore l'impaginazione (react-pdf 4.9): l'interlinea sta solo sui testi che la usano */}
        <Text style={s.pageNumber} fixed render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />

        <Text style={s.title}>{DOC_TEXT.title}</Text>
        <Text style={s.course}>{data.courseName}</Text>
        <View style={[s.rule, { marginTop: PT.block }]} />
        <View style={s.meta}>
          <Meta s={s} label="Created" value={data.createdLabel} />
          <Meta s={s} label="Days to the exam" value={String(data.days)} />
          <Meta s={s} label="Scope" value={data.scopeLabel} />
          <Meta s={s} label="To study" value={`${data.toStudy} concepts`} />
          <Meta s={s} label="Sessions" value={String(data.sessionCount)} />
          <Meta s={s} label="Already known" value={`${data.knownCount} concepts`} />
        </View>
        <View style={s.rule} />
        <View style={s.known}>
          <Text style={s.label}>What you already know</Text>
          <Text style={s.body}>{data.known.length ? data.known.join(", ") : "Nothing marked as known: the plan covers every concept in scope."}</Text>
        </View>

        <View style={s.glance}>
          <Text style={s.label}>Plan at a glance</Text>
          {data.sessions.map((session) => (
            <View key={session.id} style={s.glanceRow} wrap={false}>
              <Text style={s.glanceTitle}>{session.title}</Text>
              <Text style={s.glanceCount}>{`${session.concepts.length} concepts`}</Text>
              <Text style={s.glanceLessons}>{session.lessons}</Text>
            </View>
          ))}
        </View>

        {data.sessions.map((session) => (
          <View key={session.id} style={s.session} wrap={false}>
            <View style={[s.rule, { marginBottom: PT.block }]} />
            <View style={s.sessionHead}>
              <Text style={s.sessionTitle}>{session.title}</Text>
              <Text style={s.count}>{session.concepts.length} concepts</Text>
            </View>
            <View style={s.concepts}>
              {session.concepts.map((c, i) => (
                <View key={c.id} style={s.concept}>
                  <Text style={s.conceptNum}>{i + 1}.</Text>
                  <Text style={s.conceptName}>
                    {c.name}
                    {c.lesson ? <Text style={s.lesson}>{`  ${c.lesson}`}</Text> : null}
                    {c.noEvidence ? <Text style={s.noEvidence}>{`  (${DOC_TEXT.noEvidence})`}</Text> : null}
                  </Text>
                </View>
              ))}
            </View>
            {session.withoutEvidence.length > 0 && (
              <Text style={[s.hint, { marginBottom: PT.gap * 2 }]}>{`No evidence in the course: ${session.withoutEvidence.join(", ")}. There are no slides to base them on.`}</Text>
            )}
            <Text style={s.label}>Why this order</Text>
            <Text style={s.why}>{session.why ?? "The Planner did not write this session."}</Text>
            {session.look.length > 0 && (
              <View>
                <Text style={s.label}>Slides to look at</Text>
                {session.look.map((l, i) => (
                  <View key={i} style={s.lookItem}>
                    <Text style={s.ref}>{l.ref}</Text>
                    <Text style={s.note}>{l.note}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}

        <View style={s.boundary} wrap={false}>
          <Text style={s.boundaryTitle}>{DOC_TEXT.boundary}</Text>
          <Text style={s.hint}>{DOC_TEXT.boundaryDetail}</Text>
        </View>
      </Page>
    </Document>
  );
}

function Meta({ s, label, value }: { s: ReturnType<typeof makeStyles>; label: string; value: string }) {
  return (
    <View style={s.metaItem}>
      <Text style={s.metaLabel}>{label}</Text>
      <Text style={s.metaValue}>{value}</Text>
    </View>
  );
}

// Legge i token del design system da :root, così il PDF usa la stessa palette dell'app.
function readPalette(): Palette {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim();
  return { foreground: v("--foreground"), muted: v("--muted"), mutedForeground: v("--muted-foreground"), border: v("--border"), primary: v("--primary"), card: v("--card") };
}

export async function renderPlanPdf(data: PlanDocumentData): Promise<Blob> {
  const origin = window.location.origin;
  registerFonts(origin);
  return pdf(<PlanPdf data={data} palette={readPalette()} origin={origin} />).toBlob();
}
