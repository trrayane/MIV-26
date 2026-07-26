import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { ZipArchive } from 'archiver';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { db, getMeta, setMeta } from './db.js';
import { PROGRAM } from './curriculum.js';
import { askAssistant } from './assistant.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'miv-admin';

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '256kb' }));
app.use('/files', express.static(path.join(__dirname, '..', 'public')));

/* ------------------------------------------------------------------ auth */

function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'missing_token', message: 'Sign in to continue.' });
  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'invalid_token', message: 'Session expired. Sign in again.' });
  }
}

app.post('/api/auth/login', (req, res) => {
  const { password } = req.body ?? {};
  if (typeof password !== 'string' || !password) {
    return res.status(400).json({ error: 'missing_password', message: 'Enter the admin password.' });
  }
  const hash = process.env.ADMIN_PASSWORD_HASH;
  const ok = hash ? bcrypt.compareSync(password, hash) : password === ADMIN_PASSWORD;
  if (!ok) return res.status(401).json({ error: 'bad_password', message: 'That password does not match.' });
  const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '12h' });
  res.json({ token, expiresIn: 43200 });
});

app.get('/api/auth/me', requireAdmin, (_req, res) => res.json({ role: 'admin' }));

/* --------------------------------------------------------------- reading */

const qSemesters = db.prepare('SELECT * FROM semesters ORDER BY number');
const qUnits = db.prepare('SELECT * FROM units WHERE semester_id = ? ORDER BY position, id');
const qCourses = db.prepare('SELECT * FROM courses WHERE unit_id = ? ORDER BY position, id');
const qChapters = db.prepare('SELECT * FROM chapters WHERE course_id = ? ORDER BY position');
const qResources = db.prepare('SELECT * FROM resources WHERE course_id = ? ORDER BY position, id');
const qSemesterLinks = db.prepare('SELECT * FROM semester_links WHERE semester_id = ? ORDER BY position, id');

function buildCourse(course, unit, semester) {
  return {
    ...course,
    unit: { id: unit.id, code: unit.code, type: unit.type, label_fr: unit.label_fr, label_en: unit.label_en },
    semester: semester.number,
    chapters: qChapters.all(course.id),
    resources: qResources.all(course.id),
  };
}

function buildCurriculum() {
  return qSemesters.all().map((semester) => ({
    ...semester,
    driveLinks: qSemesterLinks.all(semester.id),
    units: qUnits.all(semester.id).map((unit) => ({
      ...unit,
      courses: qCourses.all(unit.id).map((course) => buildCourse(course, unit, semester)),
    })),
  }));
}

app.get('/api/program', (_req, res) => {
  const stored = getMeta('program');
  res.json(stored ? JSON.parse(stored) : PROGRAM);
});

app.get('/api/curriculum', (req, res) => {
  const all = buildCurriculum().filter((s) => s.visible);
  const n = Number(req.query.semester);
  res.json(Number.isInteger(n) ? all.filter((s) => s.number === n) : all);
});

/* ------------------------------------------------------- admin: semesters */

app.get('/api/admin/semesters', requireAdmin, (_req, res) => {
  res.json(db.prepare('SELECT number, label_fr, label_en, visible FROM semesters ORDER BY number').all());
});

app.put('/api/admin/semesters/:number/visibility', requireAdmin, (req, res) => {
  const { visible } = req.body ?? {};
  const info = db
    .prepare('UPDATE semesters SET visible = ? WHERE number = ?')
    .run(visible ? 1 : 0, req.params.number);
  if (!info.changes) return res.status(404).json({ error: 'not_found', message: 'No semester with that number.' });
  res.json(db.prepare('SELECT number, visible FROM semesters WHERE number = ?').get(req.params.number));
});

app.get('/api/stats', (_req, res) => {
  const row = db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM courses)   AS courses,
              (SELECT COUNT(*) FROM units)     AS units,
              (SELECT COUNT(*) FROM chapters)  AS chapters,
              (SELECT COUNT(*) FROM resources) AS resources,
              (SELECT SUM(credits) FROM semesters) AS credits,
              (SELECT SUM(vhs) FROM semesters)     AS hours`
    )
    .get();
  const perSemester = db
    .prepare(
      `SELECT s.number,
              SUM(c.credits)   AS credits,
              SUM(c.vhs)       AS hours,
              COUNT(c.id)      AS courses,
              (SELECT COUNT(*) FROM chapters ch JOIN courses c2 ON c2.id = ch.course_id
                 JOIN units u2 ON u2.id = c2.unit_id WHERE u2.semester_id = s.id) AS chapters
         FROM semesters s
         JOIN units u ON u.semester_id = s.id
         JOIN courses c ON c.unit_id = u.id
        GROUP BY s.id ORDER BY s.number`
    )
    .all();
  res.json({ ...row, perSemester });
});

app.get('/api/courses/:code', (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE code = ? COLLATE NOCASE').get(req.params.code);
  if (!course) return res.status(404).json({ error: 'not_found', message: 'No module with that code.' });
  const unit = db.prepare('SELECT * FROM units WHERE id = ?').get(course.unit_id);
  const semester = db.prepare('SELECT * FROM semesters WHERE id = ?').get(unit.semester_id);
  res.json(buildCourse(course, unit, semester));
});

/* --------------------------------------------------------------- assistant */

const assistantHits = new Map(); // ip -> timestamps, simple sliding-window rate limit
function rateLimited(ip) {
  const now = Date.now();
  const windowMs = 5 * 60 * 1000;
  const hits = (assistantHits.get(ip) ?? []).filter((t) => now - t < windowMs);
  hits.push(now);
  assistantHits.set(ip, hits);
  return hits.length > 12;
}

function assistantEnabled() {
  return getMeta('assistant_enabled', '1') !== '0';
}

app.get('/api/assistant/status', (_req, res) => {
  res.json({ enabled: assistantEnabled() });
});

app.put('/api/admin/assistant', requireAdmin, (req, res) => {
  setMeta('assistant_enabled', req.body?.enabled ? '1' : '0');
  res.json({ enabled: assistantEnabled() });
});

app.post('/api/assistant/ask', async (req, res) => {
  if (!assistantEnabled()) {
    return res.status(403).json({ error: 'disabled', message: 'The AI assistant is currently disabled.' });
  }
  const { code, question, lang } = req.body ?? {};
  if (typeof code !== 'string' || !code) return res.status(400).json({ error: 'invalid', message: 'Missing module code.' });
  if (typeof question !== 'string' || question.trim().length < 3) {
    return res.status(400).json({ error: 'invalid', message: 'Ask a real question.' });
  }
  if (rateLimited(req.ip)) {
    return res.status(429).json({ error: 'rate_limited', message: 'Too many questions, wait a few minutes.' });
  }

  const course = db.prepare('SELECT * FROM courses WHERE code = ? COLLATE NOCASE').get(code);
  if (!course) return res.status(404).json({ error: 'not_found', message: 'No module with that code.' });
  const chapters = db.prepare('SELECT * FROM chapters WHERE course_id = ? ORDER BY position').all(course.id);

  try {
    const { answer, usedFiles } = await askAssistant({ course, chapters, question: question.trim(), lang });
    try {
      db.prepare(
        `INSERT INTO ai_questions (course_id, course_code, question, answer, lang, used_files)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(course.id, course.code, question.trim(), answer, lang || 'fr', usedFiles || 0);
    } catch (logErr) {
      console.error('ai log error:', logErr.message);
    }
    res.json({ answer, usedFiles });
  } catch (err) {
    if (err.code === 'missing_key') {
      return res.status(503).json({ error: 'not_configured', message: 'The AI assistant is not configured yet.' });
    }
    console.error('assistant error:', err.message);
    res.status(502).json({ error: 'upstream_error', message: 'The AI assistant is unavailable right now.' });
  }
});

/* ------------------------------------------------------- admin: resources */

const KINDS = ['drive', 'pdf', 'video', 'course', 'tool', 'reference', 'lab', 'platform'];

function validateResource(body) {
  const { course_id, chapter_id, label, url, kind } = body ?? {};
  if (!Number.isInteger(course_id)) return 'Pick a module.';
  if (typeof label !== 'string' || label.trim().length < 2) return 'Give the link a name of at least 2 characters.';
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return 'The link must start with http:// or https://';
  if (kind && !KINDS.includes(kind)) return `Type must be one of: ${KINDS.join(', ')}`;
  if (chapter_id != null && !Number.isInteger(chapter_id)) return 'Chapter is invalid.';
  if (!db.prepare('SELECT 1 FROM courses WHERE id = ?').get(course_id)) return 'That module no longer exists.';
  if (chapter_id != null) {
    const ch = db.prepare('SELECT course_id FROM chapters WHERE id = ?').get(chapter_id);
    if (!ch) return 'That chapter no longer exists.';
    if (ch.course_id !== course_id) return 'That chapter belongs to another module.';
  }
  return null;
}

app.post('/api/resources', requireAdmin, (req, res) => {
  const problem = validateResource(req.body);
  if (problem) return res.status(400).json({ error: 'invalid', message: problem });
  const { course_id, chapter_id = null, label, url, kind = 'drive' } = req.body;
  const next =
    db.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS p FROM resources WHERE course_id = ?').get(course_id).p;
  const info = db
    .prepare(
      `INSERT INTO resources (course_id, chapter_id, label, url, kind, origin, position)
       VALUES (?, ?, ?, ?, ?, 'custom', ?)`
    )
    .run(course_id, chapter_id, label.trim(), url.trim(), kind, next);
  res.status(201).json(db.prepare('SELECT * FROM resources WHERE id = ?').get(info.lastInsertRowid));
});

app.put('/api/resources/:id', requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT * FROM resources WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not_found', message: 'That link was already removed.' });
  const merged = { ...existing, ...req.body, course_id: existing.course_id };
  const problem = validateResource(merged);
  if (problem) return res.status(400).json({ error: 'invalid', message: problem });
  db.prepare('UPDATE resources SET label = ?, url = ?, kind = ?, chapter_id = ? WHERE id = ?').run(
    merged.label.trim(),
    merged.url.trim(),
    merged.kind,
    merged.chapter_id ?? null,
    existing.id
  );
  res.json(db.prepare('SELECT * FROM resources WHERE id = ?').get(existing.id));
});

app.delete('/api/resources/:id', requireAdmin, (req, res) => {
  const info = db.prepare('DELETE FROM resources WHERE id = ?').run(req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'not_found', message: 'That link was already removed.' });
  res.json({ deleted: true });
});

/* --------------------------------------------------- semester Drive links */

app.get('/api/semester-links', (req, res) => {
  const n = Number(req.query.semester);
  const semester = db.prepare('SELECT id FROM semesters WHERE number = ?').get(n);
  if (!semester) return res.status(404).json({ error: 'not_found', message: 'No semester with that number.' });
  res.json(qSemesterLinks.all(semester.id));
});

app.post('/api/semester-links', requireAdmin, (req, res) => {
  const { semester, label, url } = req.body ?? {};
  const semesterNum = Number(semester);
  if (!Number.isInteger(semesterNum)) return res.status(400).json({ error: 'invalid', message: 'Pick a semester.' });
  if (typeof label !== 'string' || label.trim().length < 2) return res.status(400).json({ error: 'invalid', message: 'Give the link a name of at least 2 characters.' });
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'invalid', message: 'The link must start with http:// or https://' });

  const sem = db.prepare('SELECT id FROM semesters WHERE number = ?').get(semesterNum);
  if (!sem) return res.status(400).json({ error: 'invalid', message: 'No semester with that number.' });

  const next = db.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS p FROM semester_links WHERE semester_id = ?').get(sem.id).p;
  const info = db
    .prepare('INSERT INTO semester_links (semester_id, label, url, kind, position) VALUES (?, ?, ?, ?, ?)')
    .run(sem.id, label.trim(), url.trim(), 'drive', next);
  res.status(201).json(db.prepare('SELECT * FROM semester_links WHERE id = ?').get(info.lastInsertRowid));
});

app.delete('/api/semester-links/:id', requireAdmin, (req, res) => {
  const info = db.prepare('DELETE FROM semester_links WHERE id = ?').run(req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'not_found', message: 'That link was already removed.' });
  res.json({ deleted: true });
});

/* ---------------------------------------------------------- admin: upload */

const CATEGORY_LABEL = { cour: 'Cours', td: 'TD', tp: 'TP', exams: 'Examens' };
const ARCHIVE_EXT = new Set(['.zip', '.rar', '.7z']);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });

app.post('/api/resources/upload', requireAdmin, upload.single('file'), (req, res) => {
  const { course_id, category, chapter_id, label: customLabel } = req.body ?? {};
  const courseId = Number(course_id);
  if (!Number.isInteger(courseId)) return res.status(400).json({ error: 'invalid', message: 'Pick a module.' });
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(courseId);
  if (!course) return res.status(400).json({ error: 'invalid', message: 'That module no longer exists.' });
  if (!CATEGORY_LABEL[category]) return res.status(400).json({ error: 'invalid', message: 'Pick a valid category.' });
  if (!req.file) return res.status(400).json({ error: 'invalid', message: 'Choose a file to upload.' });

  const chapterId = chapter_id ? Number(chapter_id) : null;
  if (chapterId != null) {
    const ch = db.prepare('SELECT course_id FROM chapters WHERE id = ?').get(chapterId);
    if (!ch || ch.course_id !== courseId) return res.status(400).json({ error: 'invalid', message: 'That chapter is invalid.' });
  }

  // Store the file under the module's real semester (s1, s2, …), not a hardcoded folder.
  const sem = db
    .prepare('SELECT s.number FROM semesters s JOIN units u ON u.semester_id = s.id WHERE u.id = ?')
    .get(course.unit_id);
  const semDir = `s${sem?.number ?? 1}`;

  const dir = path.join(__dirname, '..', 'public', semDir, course.code, category);
  fs.mkdirSync(dir, { recursive: true });

  const original = path.basename(req.file.originalname);
  const ext = path.extname(original);
  const base = path.basename(original, ext);
  let filename = original;
  let n = 1;
  while (fs.existsSync(path.join(dir, filename))) {
    filename = `${base} (${n})${ext}`;
    n += 1;
  }
  fs.writeFileSync(path.join(dir, filename), req.file.buffer);

  const url = `/files/${semDir}/${course.code}/${category}/${encodeURIComponent(filename)}`;
  const kind = ARCHIVE_EXT.has(ext.toLowerCase()) ? 'tool' : 'pdf';
  const title = (customLabel || '').trim() || base.replace(/[_-]+/g, ' ').trim();
  const label = `${CATEGORY_LABEL[category]} — ${title}`;

  const next =
    db.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS p FROM resources WHERE course_id = ?').get(courseId).p;
  const info = db
    .prepare(
      `INSERT INTO resources (course_id, chapter_id, label, url, kind, origin, position)
       VALUES (?, ?, ?, ?, ?, 'custom', ?)`
    )
    .run(courseId, chapterId, label, url, kind, next);
  res.status(201).json(db.prepare('SELECT * FROM resources WHERE id = ?').get(info.lastInsertRowid));
});

app.put('/api/courses/:id/drive', requireAdmin, (req, res) => {
  const { drive_url } = req.body ?? {};
  if (drive_url && !/^https?:\/\//i.test(drive_url)) {
    return res.status(400).json({ error: 'invalid', message: 'The folder link must start with http:// or https://' });
  }
  const info = db.prepare('UPDATE courses SET drive_url = ? WHERE id = ?').run(drive_url || null, req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'not_found', message: 'No module with that id.' });
  res.json(db.prepare('SELECT id, code, drive_url FROM courses WHERE id = ?').get(req.params.id));
});

app.get('/api/admin/courses', requireAdmin, (_req, res) => {
  res.json(
    db
      .prepare(
        `SELECT c.id, c.code, c.title_fr, c.title_en, c.drive_url, u.code AS unit_code, s.number AS semester,
                (SELECT COUNT(*) FROM resources r WHERE r.course_id = c.id) AS resource_count
           FROM courses c JOIN units u ON u.id = c.unit_id JOIN semesters s ON s.id = u.semester_id
          ORDER BY s.number, u.position, c.position`
      )
      .all()
  );
});

/* ------------------------------------------------ student accounts */

function requireStudent(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'missing_token', message: 'Sign in to continue.' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== 'student') throw new Error('wrong_role');
    req.student = payload;
    next();
  } catch {
    res.status(401).json({ error: 'invalid_token', message: 'Session expired. Sign in again.' });
  }
}

const isEmail = (v) => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

function studentToken(row) {
  return jwt.sign({ role: 'student', id: row.id, email: row.email }, JWT_SECRET, { expiresIn: '30d' });
}

function studentData(id) {
  const row = db.prepare('SELECT data FROM student_data WHERE student_id = ?').get(id);
  try {
    return row ? JSON.parse(row.data) : {};
  } catch {
    return {};
  }
}

app.post('/api/student/register', (req, res) => {
  const { email, password, name } = req.body ?? {};
  if (!isEmail(email)) return res.status(400).json({ error: 'invalid', message: 'Enter a valid email.' });
  if (typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: 'invalid', message: 'Password must be at least 6 characters.' });
  }
  const normalized = email.trim().toLowerCase();
  if (db.prepare('SELECT 1 FROM students WHERE email = ?').get(normalized)) {
    return res.status(409).json({ error: 'exists', message: 'An account with this email already exists.' });
  }
  const hash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare('INSERT INTO students (email, password_hash, name) VALUES (?, ?, ?)')
    .run(normalized, hash, (name || '').trim() || null);
  const row = { id: info.lastInsertRowid, email: normalized, name: (name || '').trim() || null };
  db.prepare('INSERT INTO student_data (student_id, data) VALUES (?, ?)').run(row.id, '{}');
  res.status(201).json({ token: studentToken(row), student: { email: row.email, name: row.name }, data: {} });
});

app.post('/api/student/login', (req, res) => {
  const { email, password } = req.body ?? {};
  if (!isEmail(email) || typeof password !== 'string') {
    return res.status(400).json({ error: 'invalid', message: 'Enter your email and password.' });
  }
  const normalized = email.trim().toLowerCase();
  const row = db.prepare('SELECT * FROM students WHERE email = ?').get(normalized);
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    return res.status(401).json({ error: 'bad_credentials', message: 'Wrong email or password.' });
  }
  res.json({ token: studentToken(row), student: { email: row.email, name: row.name }, data: studentData(row.id) });
});

app.get('/api/student/me', requireStudent, (req, res) => {
  const row = db.prepare('SELECT email, name FROM students WHERE id = ?').get(req.student.id);
  if (!row) return res.status(404).json({ error: 'not_found', message: 'Account not found.' });
  res.json({ student: row, data: studentData(req.student.id) });
});

app.put('/api/student/data', requireStudent, (req, res) => {
  const { data } = req.body ?? {};
  if (data == null || typeof data !== 'object' || Array.isArray(data)) {
    return res.status(400).json({ error: 'invalid', message: 'Invalid data.' });
  }
  const json = JSON.stringify(data);
  if (json.length > 512 * 1024) return res.status(413).json({ error: 'too_large', message: 'Too much data.' });
  db.prepare(
    `INSERT INTO student_data (student_id, data, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(student_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
  ).run(req.student.id, json);
  res.json({ saved: true });
});

/* ------------------------------------------------ recent resources (public) */

app.get('/api/resources/recent', (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days) || 14, 1), 90);
  const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 50);
  const rows = db
    .prepare(
      `SELECT r.id, r.label, r.url, r.kind, r.created_at,
              c.code AS course_code, c.title_fr AS course_title_fr, c.title_en AS course_title_en,
              s.number AS semester
         FROM resources r
         JOIN courses c ON c.id = r.course_id
         JOIN units u ON u.id = c.unit_id
         JOIN semesters s ON s.id = u.semester_id
        WHERE s.visible = 1
          AND r.created_at >= datetime('now', ?)
        ORDER BY r.created_at DESC, r.id DESC
        LIMIT ?`
    )
    .all(`-${days} days`, limit);
  res.json(rows);
});

/* ------------------------------------------------ chapters (admin CRUD) */

app.post('/api/courses/:id/chapters', requireAdmin, (req, res) => {
  const courseId = Number(req.params.id);
  const course = db.prepare('SELECT id FROM courses WHERE id = ?').get(courseId);
  if (!course) return res.status(404).json({ error: 'not_found', message: 'No module with that id.' });
  const { title_fr, title_en } = req.body ?? {};
  if (typeof title_fr !== 'string' || title_fr.trim().length < 2) {
    return res.status(400).json({ error: 'invalid', message: 'Give the chapter a title of at least 2 characters.' });
  }
  const next = db.prepare('SELECT COALESCE(MAX(position), 0) + 1 AS p FROM chapters WHERE course_id = ?').get(courseId).p;
  const info = db
    .prepare('INSERT INTO chapters (course_id, position, title_fr, title_en) VALUES (?, ?, ?, ?)')
    .run(courseId, next, title_fr.trim(), (title_en || title_fr).trim());
  res.status(201).json(db.prepare('SELECT * FROM chapters WHERE id = ?').get(info.lastInsertRowid));
});

app.put('/api/chapters/:id', requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT * FROM chapters WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not_found', message: 'That chapter was already removed.' });
  const { title_fr = existing.title_fr, title_en = existing.title_en } = req.body ?? {};
  if (typeof title_fr !== 'string' || title_fr.trim().length < 2) {
    return res.status(400).json({ error: 'invalid', message: 'Give the chapter a title of at least 2 characters.' });
  }
  db.prepare('UPDATE chapters SET title_fr = ?, title_en = ? WHERE id = ?').run(
    title_fr.trim(),
    (title_en || title_fr).trim(),
    existing.id
  );
  res.json(db.prepare('SELECT * FROM chapters WHERE id = ?').get(existing.id));
});

app.delete('/api/chapters/:id', requireAdmin, (req, res) => {
  const info = db.prepare('DELETE FROM chapters WHERE id = ?').run(req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'not_found', message: 'That chapter was already removed.' });
  res.json({ deleted: true });
});

/* ------------------------------------------------ exam dates */

const EXAM_KINDS = ['exam', 'td', 'tp', 'deadline', 'other'];

app.get('/api/exam-dates', (req, res) => {
  const n = Number(req.query.semester);
  const base = `SELECT e.id, e.title_fr, e.title_en, e.date, e.kind, s.number AS semester,
                       c.code AS course_code
                  FROM exam_dates e
                  JOIN semesters s ON s.id = e.semester_id
                  LEFT JOIN courses c ON c.id = e.course_id
                 WHERE s.visible = 1`;
  const rows = Number.isInteger(n)
    ? db.prepare(`${base} AND s.number = ? ORDER BY e.date`).all(n)
    : db.prepare(`${base} ORDER BY e.date`).all();
  res.json(rows);
});

app.get('/api/admin/exam-dates', requireAdmin, (_req, res) => {
  res.json(
    db
      .prepare(
        `SELECT e.id, e.title_fr, e.title_en, e.date, e.kind, s.number AS semester, c.code AS course_code
           FROM exam_dates e
           JOIN semesters s ON s.id = e.semester_id
           LEFT JOIN courses c ON c.id = e.course_id
          ORDER BY e.date`
      )
      .all()
  );
});

app.post('/api/exam-dates', requireAdmin, (req, res) => {
  const { semester, title_fr, title_en, date, kind = 'exam', course_code } = req.body ?? {};
  const sem = db.prepare('SELECT id FROM semesters WHERE number = ?').get(Number(semester));
  if (!sem) return res.status(400).json({ error: 'invalid', message: 'Pick a semester.' });
  if (typeof title_fr !== 'string' || title_fr.trim().length < 2) {
    return res.status(400).json({ error: 'invalid', message: 'Give the entry a title of at least 2 characters.' });
  }
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'invalid', message: 'Pick a valid date.' });
  }
  if (!EXAM_KINDS.includes(kind)) return res.status(400).json({ error: 'invalid', message: 'Invalid kind.' });
  let courseId = null;
  if (course_code) {
    const c = db.prepare('SELECT id FROM courses WHERE code = ? COLLATE NOCASE').get(course_code);
    courseId = c ? c.id : null;
  }
  const info = db
    .prepare(
      `INSERT INTO exam_dates (semester_id, course_id, title_fr, title_en, date, kind)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(sem.id, courseId, title_fr.trim(), (title_en || title_fr).trim(), date, kind);
  res.status(201).json(db.prepare('SELECT * FROM exam_dates WHERE id = ?').get(info.lastInsertRowid));
});

app.delete('/api/exam-dates/:id', requireAdmin, (req, res) => {
  const info = db.prepare('DELETE FROM exam_dates WHERE id = ?').run(req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'not_found', message: 'That entry was already removed.' });
  res.json({ deleted: true });
});

/* ------------------------------------------------ AI question history (admin) */

app.get('/api/admin/ai-questions', requireAdmin, (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
  res.json(
    db
      .prepare(
        `SELECT id, course_code, question, answer, lang, used_files, created_at
           FROM ai_questions ORDER BY created_at DESC, id DESC LIMIT ?`
      )
      .all(limit)
  );
});

app.delete('/api/admin/ai-questions/:id', requireAdmin, (req, res) => {
  const info = db.prepare('DELETE FROM ai_questions WHERE id = ?').run(req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'not_found', message: 'Already removed.' });
  res.json({ deleted: true });
});

/* ------------------------------------------------ module ZIP download */

app.get('/api/courses/:code/download', (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE code = ? COLLATE NOCASE').get(req.params.code);
  if (!course) return res.status(404).json({ error: 'not_found', message: 'No module with that code.' });

  const rows = db
    .prepare("SELECT label, url FROM resources WHERE course_id = ? AND url LIKE '/files/%' ORDER BY position, id")
    .all(course.id);

  const files = rows
    .map((r) => {
      const rel = r.url.replace(/^\/files\//, '');
      const abs = path.join(__dirname, '..', 'public', ...rel.split('/').map(decodeURIComponent));
      return fs.existsSync(abs) ? { abs, name: path.basename(abs) } : null;
    })
    .filter(Boolean);

  if (files.length === 0) {
    return res.status(404).json({ error: 'no_files', message: 'No downloadable files for this module.' });
  }

  res.attachment(`${course.code}.zip`);
  const archive = new ZipArchive({ zlib: { level: 6 } });
  archive.on('error', (err) => {
    console.error('zip error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'zip_error', message: 'Could not build the archive.' });
  });
  archive.pipe(res);
  const seen = new Set();
  for (const f of files) {
    let name = f.name;
    let i = 1;
    while (seen.has(name)) {
      const ext = path.extname(f.name);
      name = `${path.basename(f.name, ext)} (${i})${ext}`;
      i += 1;
    }
    seen.add(name);
    archive.file(f.abs, { name });
  }
  archive.finalize();
});

/* ------------------------------------------------------------ health + spa */

app.get('/api/health', (_req, res) => res.json({ ok: true, uptime: process.uptime() }));

const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use((req, res) => res.status(404).json({ error: 'not_found', message: `No route for ${req.method} ${req.path}` }));

app.listen(PORT, () => console.log(`MIV Hub API listening on http://localhost:${PORT}`));
