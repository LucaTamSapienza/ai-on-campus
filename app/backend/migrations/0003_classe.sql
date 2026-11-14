-- Classe simulata: studenti sintetici (profili inventati, nessun dato reale), le lezioni che
-- ognuno ha seguito, e le esecuzioni in cui la classe sostiene una domanda d'esame.

-- prior_grade: media dei voti pregressi in trentesimi, inventata. style: come studia, in una frase.
CREATE TABLE students (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id),
  name TEXT NOT NULL,
  prior_grade REAL NOT NULL,
  style TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (course_id, name)
);

-- Le lezioni (fonti) seguite. I concetti seguiti si ricavano da qui: un concetto è seguito se ha
-- almeno un passaggio di prova in una lezione seguita.
CREATE TABLE student_sources (
  student_id TEXT NOT NULL REFERENCES students(id),
  source_id TEXT NOT NULL REFERENCES sources(id),
  PRIMARY KEY (student_id, source_id)
);

-- Un'esecuzione della classe su una versione di una domanda. retrieval: JSON {terms, concepts}.
CREATE TABLE class_runs (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL REFERENCES questions(id),
  question_version_id TEXT NOT NULL REFERENCES question_versions(id),
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'done', 'error')),
  error TEXT,
  retrieval TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TEXT
);
CREATE INDEX class_runs_question ON class_runs(question_id, created_at);
CREATE UNIQUE INDEX class_runs_one_active ON class_runs(question_id) WHERE status = 'running';

-- I passaggi recuperati per la domanda, in ordine: ogni studente ne riceve solo la parte che
-- viene dalle lezioni che ha seguito.
CREATE TABLE class_run_passages (
  run_id TEXT NOT NULL REFERENCES class_runs(id),
  passage_id TEXT NOT NULL REFERENCES passages(id),
  rank INTEGER NOT NULL,
  PRIMARY KEY (run_id, passage_id)
);

-- Una risposta per studente. passage_ids: JSON, i passaggi che ha ricevuto. missing: JSON, i
-- concetti toccati dalla domanda che il suo profilo non ha seguito. per_criterion: JSON come in grades.
CREATE TABLE class_answers (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES class_runs(id),
  student_id TEXT NOT NULL REFERENCES students(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'done', 'error')),
  answer TEXT,
  passage_ids TEXT,
  missing TEXT,
  total REAL,
  max REAL,
  per_criterion TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TEXT,
  UNIQUE (run_id, student_id)
);
