import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Add your Neon connection string to the environment.');
}

/** Neon HTTP client — every query is async: `await sql`SELECT …``. Serverless-friendly. */
export const sql = neon(process.env.DATABASE_URL);

/** Creates the schema if it does not exist. Safe to call on every cold start. */
export async function initSchema() {
  await sql`CREATE TABLE IF NOT EXISTS semesters (
    id        SERIAL PRIMARY KEY,
    number    INTEGER NOT NULL UNIQUE,
    label_fr  TEXT NOT NULL,
    label_en  TEXT NOT NULL,
    credits   INTEGER NOT NULL,
    coef      INTEGER NOT NULL,
    vhs       INTEGER NOT NULL,
    weekly_c  TEXT,
    weekly_td TEXT,
    weekly_tp TEXT,
    visible   INTEGER NOT NULL DEFAULT 1
  )`;

  await sql`CREATE TABLE IF NOT EXISTS units (
    id          SERIAL PRIMARY KEY,
    semester_id INTEGER NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
    code        TEXT NOT NULL,
    type        TEXT NOT NULL,
    label_fr    TEXT NOT NULL,
    label_en    TEXT NOT NULL,
    credits     INTEGER NOT NULL,
    coef        INTEGER NOT NULL,
    vhs         INTEGER NOT NULL,
    position    INTEGER NOT NULL DEFAULT 0,
    UNIQUE (semester_id, code)
  )`;

  await sql`CREATE TABLE IF NOT EXISTS courses (
    id          SERIAL PRIMARY KEY,
    unit_id     INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    code        TEXT NOT NULL,
    title_fr    TEXT NOT NULL,
    title_en    TEXT NOT NULL,
    summary_fr  TEXT,
    summary_en  TEXT,
    prereq_fr   TEXT,
    prereq_en   TEXT,
    teachers    TEXT,
    credits     INTEGER NOT NULL,
    coef        INTEGER NOT NULL,
    vhs         INTEGER NOT NULL,
    h_c         DOUBLE PRECISION NOT NULL DEFAULT 0,
    h_td        DOUBLE PRECISION NOT NULL DEFAULT 0,
    h_tp        DOUBLE PRECISION NOT NULL DEFAULT 0,
    continu     DOUBLE PRECISION NOT NULL DEFAULT 0,
    examen      DOUBLE PRECISION NOT NULL DEFAULT 0,
    drive_url   TEXT,
    position    INTEGER NOT NULL DEFAULT 0,
    UNIQUE (unit_id, code)
  )`;

  await sql`CREATE TABLE IF NOT EXISTS chapters (
    id        SERIAL PRIMARY KEY,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    position  INTEGER NOT NULL,
    title_fr  TEXT NOT NULL,
    title_en  TEXT NOT NULL
  )`;

  await sql`CREATE TABLE IF NOT EXISTS resources (
    id          SERIAL PRIMARY KEY,
    course_id   INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    chapter_id  INTEGER REFERENCES chapters(id) ON DELETE CASCADE,
    label       TEXT NOT NULL,
    url         TEXT NOT NULL,
    kind        TEXT NOT NULL DEFAULT 'drive',
    origin      TEXT NOT NULL DEFAULT 'custom',
    position    INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_resources_course ON resources(course_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_chapters_course ON chapters(course_id)`;

  await sql`CREATE TABLE IF NOT EXISTS semester_links (
    id          SERIAL PRIMARY KEY,
    semester_id INTEGER NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
    label       TEXT NOT NULL,
    url         TEXT NOT NULL,
    kind        TEXT NOT NULL DEFAULT 'drive',
    position    INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_semester_links_semester ON semester_links(semester_id)`;

  await sql`CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`;

  await sql`CREATE TABLE IF NOT EXISTS exam_dates (
    id          SERIAL PRIMARY KEY,
    semester_id INTEGER NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
    course_id   INTEGER REFERENCES courses(id) ON DELETE CASCADE,
    title_fr    TEXT NOT NULL,
    title_en    TEXT NOT NULL,
    date        TEXT NOT NULL,
    kind        TEXT NOT NULL DEFAULT 'exam',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_exam_dates_semester ON exam_dates(semester_id)`;

  await sql`CREATE TABLE IF NOT EXISTS ai_questions (
    id          SERIAL PRIMARY KEY,
    course_id   INTEGER REFERENCES courses(id) ON DELETE SET NULL,
    course_code TEXT NOT NULL,
    question    TEXT NOT NULL,
    answer      TEXT,
    lang        TEXT,
    used_files  INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_ai_questions_created ON ai_questions(created_at)`;

  await sql`CREATE TABLE IF NOT EXISTS students (
    id            SERIAL PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name          TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS student_data (
    student_id INTEGER PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
    data       TEXT NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
}

export async function getMeta(key, fallback = null) {
  const rows = await sql`SELECT value FROM meta WHERE key = ${key}`;
  return rows.length ? rows[0].value : fallback;
}

export async function setMeta(key, value) {
  await sql`
    INSERT INTO meta (key, value) VALUES (${key}, ${String(value)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
}
