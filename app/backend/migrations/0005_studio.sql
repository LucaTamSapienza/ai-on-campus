-- Piano di studio dello studente (blocco 3). L'ordine e le sessioni li calcola il backend dal grafo;
-- il Pianificatore scrive solo la spiegazione di ogni sessione, citando passaggi già nel grafo.
-- Nessun legame con esame, attacchi o classe: il Pianificatore non legge quelle tabelle.

CREATE TABLE study_plans (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id),
  days INTEGER NOT NULL,
  -- 'svolte': solo le lezioni segnate come svolte dal docente; 'tutte': nessuna segnata.
  scope TEXT NOT NULL CHECK (scope IN ('svolte', 'tutte')),
  -- JSON: lezioni (source id) e concetti che lo studente dice di conoscere già.
  known_lessons TEXT NOT NULL DEFAULT '[]',
  known_concepts TEXT NOT NULL DEFAULT '[]',
  -- JSON: conteggi del calcolo (concetti nel perimetro, già noti, da studiare, cicli spezzati).
  stats TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'done', 'error')),
  error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TEXT
);
CREATE INDEX study_plans_course ON study_plans(course_id, created_at);

CREATE TABLE study_sessions (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES study_plans(id),
  ordinal INTEGER NOT NULL,
  day INTEGER NOT NULL,
  -- JSON: concetti in ordine di studio, [{id, after: [id del prerequisito già visto]}].
  concepts TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'done', 'error')),
  -- Scritti dal Pianificatore dopo la validazione: perché quest'ordine, cosa guardare.
  why TEXT,
  -- JSON: [{passageId, note}], ogni passaggio verificato fra quelli ricevuti.
  look TEXT NOT NULL DEFAULT '[]',
  error TEXT,
  UNIQUE (plan_id, ordinal)
);
