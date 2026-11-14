-- Ontologia del corso: corso -> argomenti -> concetti, con le prove nei passaggi delle fonti.
-- Gli identificatori li genera sempre il backend.

CREATE TABLE courses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sources (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id),
  kind TEXT NOT NULL CHECK (kind IN ('document', 'transcript')),
  title TEXT NOT NULL,
  lesson_date TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'done', 'error')),
  error TEXT,
  -- SHA-256 del testo: lo stesso contenuto nello stesso corso non crea doppioni.
  content_hash TEXT NOT NULL,
  -- Ultima finestra del Cartografo scritta in D1: una ripresa riparte da qui.
  windows_done INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (course_id, content_hash)
);
CREATE INDEX sources_course ON sources(course_id);

CREATE TABLE passages (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(id),
  course_id TEXT NOT NULL REFERENCES courses(id),
  ordinal INTEGER NOT NULL,
  locator TEXT NOT NULL,
  text TEXT NOT NULL,
  -- 1 se la slide ha solo titolo o figure: testo non estratto, non vale come prova.
  thin INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX passages_source ON passages(source_id, ordinal);

CREATE TABLE topics (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id),
  name TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  ordinal INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX topics_course ON topics(course_id);

CREATE TABLE concepts (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id),
  topic_id TEXT REFERENCES topics(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  definition TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'concetto' CHECK (kind IN ('concetto', 'metodo', 'risultato', 'esempio')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (course_id, slug)
);

CREATE TABLE concept_passages (
  concept_id TEXT NOT NULL REFERENCES concepts(id),
  passage_id TEXT NOT NULL REFERENCES passages(id),
  role TEXT NOT NULL DEFAULT 'uso' CHECK (role IN ('definizione', 'uso', 'esempio')),
  PRIMARY KEY (concept_id, passage_id)
);
CREATE INDEX concept_passages_passage ON concept_passages(passage_id);

CREATE TABLE relations (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id),
  from_concept_id TEXT NOT NULL REFERENCES concepts(id),
  to_concept_id TEXT NOT NULL REFERENCES concepts(id),
  type TEXT NOT NULL CHECK (type IN ('prerequisito', 'parte_di', 'generalizza', 'usa', 'contrasta')),
  note TEXT NOT NULL DEFAULT '',
  passage_id TEXT REFERENCES passages(id),
  UNIQUE (from_concept_id, to_concept_id, type)
);
CREATE INDEX relations_course ON relations(course_id);
CREATE INDEX relations_to ON relations(to_concept_id);

CREATE TABLE model_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0,
  ref TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX model_calls_created ON model_calls(created_at);
