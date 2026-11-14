-- Esame e triplo attacco: domande con versioni, esecuzioni degli agenti, voti, scheda del Revisore,
-- decisioni del docente. Più la ricerca a testo pieno sui passaggi del corso.

CREATE TABLE exams (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id),
  title TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX exams_course ON exams(course_id);

-- current_version_id è nullo finché non esiste la versione 1 (stesso batch della creazione).
CREATE TABLE questions (
  id TEXT PRIMARY KEY,
  exam_id TEXT NOT NULL REFERENCES exams(id),
  course_id TEXT NOT NULL REFERENCES courses(id),
  ordinal INTEGER NOT NULL,
  current_version_id TEXT REFERENCES question_versions(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX questions_exam ON questions(exam_id, ordinal);

-- rubric: JSON, elenco di {id, criterion, points, expected?}. Solo la rotta della decisione
-- e la creazione della domanda scrivono qui: nessun agente.
CREATE TABLE question_versions (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL REFERENCES questions(id),
  version INTEGER NOT NULL,
  text TEXT NOT NULL,
  rubric TEXT NOT NULL,
  max_points REAL NOT NULL,
  origin TEXT NOT NULL CHECK (origin IN ('docente', 'proposta_approvata', 'proposta_modificata')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (question_id, version)
);

-- retrieval: JSON {terms, concepts}, i termini e i concetti usati per il recupero.
CREATE TABLE attack_runs (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL REFERENCES questions(id),
  question_version_id TEXT NOT NULL REFERENCES question_versions(id),
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'done', 'error')),
  error TEXT,
  retrieval TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TEXT
);
CREATE INDEX attack_runs_version ON attack_runs(question_version_id, created_at);
-- Una sola esecuzione attiva per domanda.
CREATE UNIQUE INDEX attack_runs_one_active ON attack_runs(question_id) WHERE status = 'running';

-- Il percorso del recupero: quali passaggi, in che ordine e perché (termine o arco del grafo).
CREATE TABLE run_passages (
  run_id TEXT NOT NULL REFERENCES attack_runs(id),
  passage_id TEXT NOT NULL REFERENCES passages(id),
  rank INTEGER NOT NULL,
  reason TEXT NOT NULL,
  PRIMARY KEY (run_id, passage_id)
);

CREATE TABLE attacks (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES attack_runs(id),
  agent TEXT NOT NULL CHECK (agent IN ('esterno', 'letterale', 'cavillatore')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'done', 'error')),
  answer TEXT,
  finding TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TEXT,
  UNIQUE (run_id, agent)
);

-- Una riga per risposta corretta: reading_index 0 per Esterno e Letterale, 0 e 1 per le due
-- letture del Cavillatore. error valorizzato se il Correttore non è riuscito.
CREATE TABLE grades (
  id TEXT PRIMARY KEY,
  attack_id TEXT NOT NULL REFERENCES attacks(id),
  reading_index INTEGER NOT NULL,
  total REAL,
  max REAL NOT NULL,
  per_criterion TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (attack_id, reading_index)
);

-- verdicts li calcola il backend; il Revisore scrive solo proposta e motivazione.
CREATE TABLE reviews (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL UNIQUE REFERENCES attack_runs(id),
  verdicts TEXT NOT NULL,
  proposed_text TEXT,
  rationale TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE decisions (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL REFERENCES questions(id),
  review_id TEXT REFERENCES reviews(id),
  from_version_id TEXT NOT NULL REFERENCES question_versions(id),
  to_version_id TEXT REFERENCES question_versions(id),
  action TEXT NOT NULL CHECK (action IN ('approvata', 'modificata', 'tenuta')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX decisions_question ON decisions(question_id, created_at);

-- Concetti del grafo toccati da una versione della domanda: servono alla copertura.
CREATE TABLE question_version_concepts (
  question_version_id TEXT NOT NULL REFERENCES question_versions(id),
  concept_id TEXT NOT NULL REFERENCES concepts(id),
  PRIMARY KEY (question_version_id, concept_id)
);

-- Ricerca a testo pieno sui passaggi. rowid = passages.rowid, passage_id per tornare all'id.
CREATE VIRTUAL TABLE passages_fts USING fts5(text, passage_id UNINDEXED, tokenize = 'porter unicode61');

INSERT INTO passages_fts (rowid, text, passage_id) SELECT rowid, text, id FROM passages;

CREATE TRIGGER passages_fts_insert AFTER INSERT ON passages BEGIN
  INSERT INTO passages_fts (rowid, text, passage_id) VALUES (new.rowid, new.text, new.id);
END;

CREATE TRIGGER passages_fts_delete AFTER DELETE ON passages BEGIN
  DELETE FROM passages_fts WHERE rowid = old.rowid;
END;

CREATE TRIGGER passages_fts_update AFTER UPDATE OF text ON passages BEGIN
  DELETE FROM passages_fts WHERE rowid = old.rowid;
  INSERT INTO passages_fts (rowid, text, passage_id) VALUES (new.rowid, new.text, new.id);
END;
