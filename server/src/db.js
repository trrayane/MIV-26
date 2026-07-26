import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new Database(path.join(DATA_DIR, 'miv.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS semesters (
  id          INTEGER PRIMARY KEY,
  number      INTEGER NOT NULL UNIQUE,
  label_fr    TEXT NOT NULL,
  label_en    TEXT NOT NULL,
  credits     INTEGER NOT NULL,
  coef        INTEGER NOT NULL,
  vhs         INTEGER NOT NULL,
  weekly_c    TEXT,
  weekly_td   TEXT,
  weekly_tp   TEXT,
  visible     INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS units (
  id          INTEGER PRIMARY KEY,
  semester_id INTEGER NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
  code        TEXT NOT NULL,
  type        TEXT NOT NULL,            -- F | M | D | P
  label_fr    TEXT NOT NULL,
  label_en    TEXT NOT NULL,
  credits     INTEGER NOT NULL,
  coef        INTEGER NOT NULL,
  vhs         INTEGER NOT NULL,
  position    INTEGER NOT NULL DEFAULT 0,
  UNIQUE (semester_id, code)
);

CREATE TABLE IF NOT EXISTS courses (
  id          INTEGER PRIMARY KEY,
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
  h_c         REAL NOT NULL DEFAULT 0,  -- weekly lecture hours
  h_td        REAL NOT NULL DEFAULT 0,  -- weekly tutorial hours
  h_tp        REAL NOT NULL DEFAULT 0,  -- weekly lab hours
  continu     REAL NOT NULL DEFAULT 0,
  examen      REAL NOT NULL DEFAULT 0,
  drive_url   TEXT,                     -- main Drive folder, editable from /admin
  position    INTEGER NOT NULL DEFAULT 0,
  UNIQUE (unit_id, code)
);

CREATE TABLE IF NOT EXISTS chapters (
  id          INTEGER PRIMARY KEY,
  course_id   INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL,
  title_fr    TEXT NOT NULL,
  title_en    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS resources (
  id          INTEGER PRIMARY KEY,
  course_id   INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  chapter_id  INTEGER REFERENCES chapters(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  url         TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'drive', -- drive | pdf | video | course | tool | reference | lab | platform
  origin      TEXT NOT NULL DEFAULT 'custom', -- seeded | custom
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_resources_course ON resources(course_id);
CREATE INDEX IF NOT EXISTS idx_chapters_course ON chapters(course_id);

CREATE TABLE IF NOT EXISTS semester_links (
  id            INTEGER PRIMARY KEY,
  semester_id   INTEGER NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
  label         TEXT NOT NULL,
  url           TEXT NOT NULL,
  kind          TEXT NOT NULL DEFAULT 'drive',
  position      INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_semester_links_semester ON semester_links(semester_id);

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`);

const semesterCols = db.prepare("PRAGMA table_info(semesters)").all().map((c) => c.name);
if (!semesterCols.includes('visible')) {
  db.exec('ALTER TABLE semesters ADD COLUMN visible INTEGER NOT NULL DEFAULT 1');
}

export function getMeta(key, fallback = null) {
  const row = db.prepare('SELECT value FROM meta WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

export function setMeta(key, value) {
  db.prepare(
    'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, String(value));
}
