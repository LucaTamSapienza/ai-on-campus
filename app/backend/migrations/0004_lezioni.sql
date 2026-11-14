-- Lezioni svolte: il docente segna quali lezioni (fonti del corso) sono state fatte in aula.
-- Le proposte di argomenti per le domande si calcolano da qui: concetti con prove nelle lezioni svolte.
-- La registrazione di una lezione non lascia audio: resta solo la trascrizione, come fonte kind = transcript.
CREATE TABLE lessons_done (
  source_id TEXT PRIMARY KEY REFERENCES sources(id),
  course_id TEXT NOT NULL REFERENCES courses(id),
  done_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX lessons_done_course ON lessons_done(course_id);
