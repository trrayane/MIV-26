import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { put } from '@vercel/blob';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { sql, getMeta, setMeta } from './db.js';
import { PROGRAM } from './curriculum.js';
import { askAssistant } from './assistant.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'miv-admin';

const one = (rows) => (rows && rows.length ? rows[0] : null);

export const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '256kb' }));

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

async function buildCourse(course, unit, semester) {
  const [chapters, resources] = await Promise.all([
    sql`SELECT * FROM chapters WHERE course_id = ${course.id} ORDER BY position`,
    sql`SELECT * FROM resources WHERE course_id = ${course.id} ORDER BY position, id`,
  ]);
  return {
    ...course,
    unit: { id: unit.id, code: unit.code, type: unit.type, label_fr: unit.label_fr, label_en: unit.label_en },
    semester: semester.number,
    chapters,
    resources,
  };
}

async function buildCurriculum() {
  const semesters = await sql`SELECT * FROM semesters ORDER BY number`;
  const out = [];
  for (const semester of semesters) {
    const [driveLinks, units] = await Promise.all([
      sql`SELECT * FROM semester_links WHERE semester_id = ${semester.id} ORDER BY position, id`,
      sql`SELECT * FROM units WHERE semester_id = ${semester.id} ORDER BY position, id`,
    ]);
    const unitsOut = [];
    for (const unit of units) {
      const courses = await sql`SELECT * FROM courses WHERE unit_id = ${unit.id} ORDER BY position, id`;
      unitsOut.push({ ...unit, courses: await Promise.all(courses.map((c) => buildCourse(c, unit, semester))) });
    }
    out.push({ ...semester, driveLinks, units: unitsOut });
  }
  return out;
}

app.get('/api/program', async (_req, res) => {
  const stored = await getMeta('program');
  res.json(stored ? JSON.parse(stored) : PROGRAM);
});

app.get('/api/curriculum', async (req, res) => {
  const all = (await buildCurriculum()).filter((s) => s.visible);
  const n = Number(req.query.semester);
  res.json(Number.isInteger(n) ? all.filter((s) => s.number === n) : all);
});

/* ------------------------------------------------------- admin: semesters */

app.get('/api/admin/semesters', requireAdmin, async (_req, res) => {
  res.json(await sql`SELECT number, label_fr, label_en, visible FROM semesters ORDER BY number`);
});

app.put('/api/admin/semesters/:number/visibility', requireAdmin, async (req, res) => {
  const { visible } = req.body ?? {};
  const rows = await sql`
    UPDATE semesters SET visible = ${visible ? 1 : 0} WHERE number = ${Number(req.params.number)}
    RETURNING number, visible`;
  if (!rows.length) return res.status(404).json({ error: 'not_found', message: 'No semester with that number.' });
  res.json(rows[0]);
});

app.get('/api/stats', async (_req, res) => {
  const row = one(await sql`
    SELECT (SELECT COUNT(*) FROM courses)::int   AS courses,
           (SELECT COUNT(*) FROM units)::int     AS units,
           (SELECT COUNT(*) FROM chapters)::int  AS chapters,
           (SELECT COUNT(*) FROM resources)::int AS resources,
           (SELECT SUM(credits) FROM semesters)::int AS credits,
           (SELECT SUM(vhs) FROM semesters)::int     AS hours`);
  const perSemester = await sql`
    SELECT s.number,
           SUM(c.credits)::int AS credits,
           SUM(c.vhs)::int     AS hours,
           COUNT(c.id)::int    AS courses,
           (SELECT COUNT(*) FROM chapters ch JOIN courses c2 ON c2.id = ch.course_id
              JOIN units u2 ON u2.id = c2.unit_id WHERE u2.semester_id = s.id)::int AS chapters
      FROM semesters s
      JOIN units u ON u.semester_id = s.id
      JOIN courses c ON c.unit_id = u.id
     GROUP BY s.id, s.number ORDER BY s.number`;
  res.json({ ...row, perSemester });
});

app.get('/api/courses/:code', async (req, res) => {
  const course = one(await sql`SELECT * FROM courses WHERE lower(code) = lower(${req.params.code})`);
  if (!course) return res.status(404).json({ error: 'not_found', message: 'No module with that code.' });
  const unit = one(await sql`SELECT * FROM units WHERE id = ${course.unit_id}`);
  const semester = one(await sql`SELECT * FROM semesters WHERE id = ${unit.semester_id}`);
  res.json(await buildCourse(course, unit, semester));
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

async function assistantEnabled() {
  return (await getMeta('assistant_enabled', '1')) !== '0';
}

app.get('/api/assistant/status', async (_req, res) => {
  res.json({ enabled: await assistantEnabled() });
});

app.put('/api/admin/assistant', requireAdmin, async (req, res) => {
  await setMeta('assistant_enabled', req.body?.enabled ? '1' : '0');
  res.json({ enabled: await assistantEnabled() });
});

app.post('/api/assistant/ask', async (req, res) => {
  if (!(await assistantEnabled())) {
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

  const course = one(await sql`SELECT * FROM courses WHERE lower(code) = lower(${code})`);
  if (!course) return res.status(404).json({ error: 'not_found', message: 'No module with that code.' });
  const chapters = await sql`SELECT * FROM chapters WHERE course_id = ${course.id} ORDER BY position`;
  const files = await sql`
    SELECT label, url FROM resources
     WHERE course_id = ${course.id} AND kind IN ('pdf') AND url ~* '\\.(pdf)$'
     ORDER BY position, id`;

  try {
    const { answer, usedFiles } = await askAssistant({ course, chapters, files, question: question.trim(), lang });
    try {
      await sql`
        INSERT INTO ai_questions (course_id, course_code, question, answer, lang, used_files)
        VALUES (${course.id}, ${course.code}, ${question.trim()}, ${answer}, ${lang || 'fr'}, ${usedFiles || 0})`;
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

async function validateResource(body) {
  const { course_id, chapter_id, label, url, kind } = body ?? {};
  if (!Number.isInteger(course_id)) return 'Pick a module.';
  if (typeof label !== 'string' || label.trim().length < 2) return 'Give the link a name of at least 2 characters.';
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return 'The link must start with http:// or https://';
  if (kind && !KINDS.includes(kind)) return `Type must be one of: ${KINDS.join(', ')}`;
  if (chapter_id != null && !Number.isInteger(chapter_id)) return 'Chapter is invalid.';
  if (!one(await sql`SELECT 1 FROM courses WHERE id = ${course_id}`)) return 'That module no longer exists.';
  if (chapter_id != null) {
    const ch = one(await sql`SELECT course_id FROM chapters WHERE id = ${chapter_id}`);
    if (!ch) return 'That chapter no longer exists.';
    if (ch.course_id !== course_id) return 'That chapter belongs to another module.';
  }
  return null;
}

app.post('/api/resources', requireAdmin, async (req, res) => {
  const problem = await validateResource(req.body);
  if (problem) return res.status(400).json({ error: 'invalid', message: problem });
  const { course_id, chapter_id = null, label, url, kind = 'drive' } = req.body;
  const next = one(await sql`SELECT COALESCE(MAX(position), -1) + 1 AS p FROM resources WHERE course_id = ${course_id}`).p;
  const row = one(await sql`
    INSERT INTO resources (course_id, chapter_id, label, url, kind, origin, position)
    VALUES (${course_id}, ${chapter_id}, ${label.trim()}, ${url.trim()}, ${kind}, 'custom', ${next})
    RETURNING *`);
  res.status(201).json(row);
});

app.put('/api/resources/:id', requireAdmin, async (req, res) => {
  const existing = one(await sql`SELECT * FROM resources WHERE id = ${Number(req.params.id)}`);
  if (!existing) return res.status(404).json({ error: 'not_found', message: 'That link was already removed.' });
  const merged = { ...existing, ...req.body, course_id: existing.course_id };
  const problem = await validateResource(merged);
  if (problem) return res.status(400).json({ error: 'invalid', message: problem });
  const row = one(await sql`
    UPDATE resources SET label = ${merged.label.trim()}, url = ${merged.url.trim()}, kind = ${merged.kind},
           chapter_id = ${merged.chapter_id ?? null}
     WHERE id = ${existing.id} RETURNING *`);
  res.json(row);
});

app.delete('/api/resources/:id', requireAdmin, async (req, res) => {
  const rows = await sql`DELETE FROM resources WHERE id = ${Number(req.params.id)} RETURNING id`;
  if (!rows.length) return res.status(404).json({ error: 'not_found', message: 'That link was already removed.' });
  res.json({ deleted: true });
});

/* --------------------------------------------------- semester Drive links */

app.get('/api/semester-links', async (req, res) => {
  const sem = one(await sql`SELECT id FROM semesters WHERE number = ${Number(req.query.semester)}`);
  if (!sem) return res.status(404).json({ error: 'not_found', message: 'No semester with that number.' });
  res.json(await sql`SELECT * FROM semester_links WHERE semester_id = ${sem.id} ORDER BY position, id`);
});

app.post('/api/semester-links', requireAdmin, async (req, res) => {
  const { semester, label, url } = req.body ?? {};
  const semesterNum = Number(semester);
  if (!Number.isInteger(semesterNum)) return res.status(400).json({ error: 'invalid', message: 'Pick a semester.' });
  if (typeof label !== 'string' || label.trim().length < 2) return res.status(400).json({ error: 'invalid', message: 'Give the link a name of at least 2 characters.' });
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'invalid', message: 'The link must start with http:// or https://' });

  const sem = one(await sql`SELECT id FROM semesters WHERE number = ${semesterNum}`);
  if (!sem) return res.status(400).json({ error: 'invalid', message: 'No semester with that number.' });
  const next = one(await sql`SELECT COALESCE(MAX(position), -1) + 1 AS p FROM semester_links WHERE semester_id = ${sem.id}`).p;
  const row = one(await sql`
    INSERT INTO semester_links (semester_id, label, url, kind, position)
    VALUES (${sem.id}, ${label.trim()}, ${url.trim()}, 'drive', ${next}) RETURNING *`);
  res.status(201).json(row);
});

app.delete('/api/semester-links/:id', requireAdmin, async (req, res) => {
  const rows = await sql`DELETE FROM semester_links WHERE id = ${Number(req.params.id)} RETURNING id`;
  if (!rows.length) return res.status(404).json({ error: 'not_found', message: 'That link was already removed.' });
  res.json({ deleted: true });
});

/* ---------------------------------------------------------- admin: upload */

const CATEGORY_LABEL = { cour: 'Cours', td: 'TD', tp: 'TP', exams: 'Examens' };
const ARCHIVE_EXT = new Set(['.zip', '.rar', '.7z']);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });

app.post('/api/resources/upload', requireAdmin, upload.single('file'), async (req, res) => {
  const { course_id, category, chapter_id, label: customLabel } = req.body ?? {};
  const courseId = Number(course_id);
  if (!Number.isInteger(courseId)) return res.status(400).json({ error: 'invalid', message: 'Pick a module.' });
  const course = one(await sql`SELECT * FROM courses WHERE id = ${courseId}`);
  if (!course) return res.status(400).json({ error: 'invalid', message: 'That module no longer exists.' });
  if (!CATEGORY_LABEL[category]) return res.status(400).json({ error: 'invalid', message: 'Pick a valid category.' });
  if (!req.file) return res.status(400).json({ error: 'invalid', message: 'Choose a file to upload.' });

  const chapterId = chapter_id ? Number(chapter_id) : null;
  if (chapterId != null) {
    const ch = one(await sql`SELECT course_id FROM chapters WHERE id = ${chapterId}`);
    if (!ch || ch.course_id !== courseId) return res.status(400).json({ error: 'invalid', message: 'That chapter is invalid.' });
  }

  const sem = one(await sql`SELECT s.number FROM semesters s JOIN units u ON u.semester_id = s.id WHERE u.id = ${course.unit_id}`);
  const semDir = `s${sem?.number ?? 1}`;
  const original = path.basename(req.file.originalname);
  const ext = path.extname(original).toLowerCase();

  let url;
  try {
    // Store the file on Vercel Blob (persistent CDN) instead of the ephemeral disk.
    const blob = await put(`${semDir}/${course.code}/${category}/${original}`, req.file.buffer, {
      access: 'public',
      addRandomSuffix: true,
      contentType: req.file.mimetype || undefined,
    });
    url = blob.url;
  } catch (err) {
    console.error('blob upload error:', err.message);
    return res.status(502).json({ error: 'upload_failed', message: 'Could not store the file.' });
  }

  const kind = ARCHIVE_EXT.has(ext) ? 'tool' : 'pdf';
  const base = path.basename(original, path.extname(original));
  const title = (customLabel || '').trim() || base.replace(/[_-]+/g, ' ').trim();
  const label = `${CATEGORY_LABEL[category]} — ${title}`;
  const next = one(await sql`SELECT COALESCE(MAX(position), -1) + 1 AS p FROM resources WHERE course_id = ${courseId}`).p;
  const row = one(await sql`
    INSERT INTO resources (course_id, chapter_id, label, url, kind, origin, position)
    VALUES (${courseId}, ${chapterId}, ${label}, ${url}, ${kind}, 'custom', ${next}) RETURNING *`);
  res.status(201).json(row);
});

app.put('/api/courses/:id/drive', requireAdmin, async (req, res) => {
  const { drive_url } = req.body ?? {};
  if (drive_url && !/^https?:\/\//i.test(drive_url)) {
    return res.status(400).json({ error: 'invalid', message: 'The folder link must start with http:// or https://' });
  }
  const rows = await sql`
    UPDATE courses SET drive_url = ${drive_url || null} WHERE id = ${Number(req.params.id)}
    RETURNING id, code, drive_url`;
  if (!rows.length) return res.status(404).json({ error: 'not_found', message: 'No module with that id.' });
  res.json(rows[0]);
});

app.get('/api/admin/courses', requireAdmin, async (_req, res) => {
  res.json(await sql`
    SELECT c.id, c.code, c.title_fr, c.title_en, c.drive_url, u.code AS unit_code, s.number AS semester,
           (SELECT COUNT(*) FROM resources r WHERE r.course_id = c.id)::int AS resource_count
      FROM courses c JOIN units u ON u.id = c.unit_id JOIN semesters s ON s.id = u.semester_id
     ORDER BY s.number, u.position, c.position`);
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

async function studentData(id) {
  const row = one(await sql`SELECT data FROM student_data WHERE student_id = ${id}`);
  try {
    return row ? JSON.parse(row.data) : {};
  } catch {
    return {};
  }
}

app.post('/api/student/register', async (req, res) => {
  const { email, password, name } = req.body ?? {};
  if (!isEmail(email)) return res.status(400).json({ error: 'invalid', message: 'Enter a valid email.' });
  if (typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: 'invalid', message: 'Password must be at least 6 characters.' });
  }
  const normalized = email.trim().toLowerCase();
  if (one(await sql`SELECT 1 FROM students WHERE email = ${normalized}`)) {
    return res.status(409).json({ error: 'exists', message: 'An account with this email already exists.' });
  }
  const hash = bcrypt.hashSync(password, 10);
  const cleanName = (name || '').trim() || null;
  const row = one(await sql`
    INSERT INTO students (email, password_hash, name) VALUES (${normalized}, ${hash}, ${cleanName})
    RETURNING id, email, name`);
  await sql`INSERT INTO student_data (student_id, data) VALUES (${row.id}, '{}')`;
  res.status(201).json({ token: studentToken(row), student: { email: row.email, name: row.name }, data: {} });
});

app.post('/api/student/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!isEmail(email) || typeof password !== 'string') {
    return res.status(400).json({ error: 'invalid', message: 'Enter your email and password.' });
  }
  const normalized = email.trim().toLowerCase();
  const row = one(await sql`SELECT * FROM students WHERE email = ${normalized}`);
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    return res.status(401).json({ error: 'bad_credentials', message: 'Wrong email or password.' });
  }
  res.json({ token: studentToken(row), student: { email: row.email, name: row.name }, data: await studentData(row.id) });
});

app.get('/api/student/me', requireStudent, async (req, res) => {
  const row = one(await sql`SELECT email, name FROM students WHERE id = ${req.student.id}`);
  if (!row) return res.status(404).json({ error: 'not_found', message: 'Account not found.' });
  res.json({ student: row, data: await studentData(req.student.id) });
});

app.put('/api/student/data', requireStudent, async (req, res) => {
  const { data } = req.body ?? {};
  if (data == null || typeof data !== 'object' || Array.isArray(data)) {
    return res.status(400).json({ error: 'invalid', message: 'Invalid data.' });
  }
  const json = JSON.stringify(data);
  if (json.length > 512 * 1024) return res.status(413).json({ error: 'too_large', message: 'Too much data.' });
  await sql`
    INSERT INTO student_data (student_id, data, updated_at) VALUES (${req.student.id}, ${json}, now())
    ON CONFLICT (student_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`;
  res.json({ saved: true });
});

/* ------------------------------------------------ recent resources (public) */

app.get('/api/resources/recent', async (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days) || 14, 1), 90);
  const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 50);
  res.json(await sql`
    SELECT r.id, r.label, r.url, r.kind, r.created_at,
           c.code AS course_code, c.title_fr AS course_title_fr, c.title_en AS course_title_en,
           s.number AS semester
      FROM resources r
      JOIN courses c ON c.id = r.course_id
      JOIN units u ON u.id = c.unit_id
      JOIN semesters s ON s.id = u.semester_id
     WHERE s.visible = 1 AND r.created_at >= now() - ${days} * interval '1 day'
     ORDER BY r.created_at DESC, r.id DESC
     LIMIT ${limit}`);
});

/* ------------------------------------------------ chapters (admin CRUD) */

app.post('/api/courses/:id/chapters', requireAdmin, async (req, res) => {
  const courseId = Number(req.params.id);
  if (!one(await sql`SELECT id FROM courses WHERE id = ${courseId}`)) {
    return res.status(404).json({ error: 'not_found', message: 'No module with that id.' });
  }
  const { title_fr, title_en } = req.body ?? {};
  if (typeof title_fr !== 'string' || title_fr.trim().length < 2) {
    return res.status(400).json({ error: 'invalid', message: 'Give the chapter a title of at least 2 characters.' });
  }
  const next = one(await sql`SELECT COALESCE(MAX(position), 0) + 1 AS p FROM chapters WHERE course_id = ${courseId}`).p;
  const row = one(await sql`
    INSERT INTO chapters (course_id, position, title_fr, title_en)
    VALUES (${courseId}, ${next}, ${title_fr.trim()}, ${(title_en || title_fr).trim()}) RETURNING *`);
  res.status(201).json(row);
});

app.put('/api/chapters/:id', requireAdmin, async (req, res) => {
  const existing = one(await sql`SELECT * FROM chapters WHERE id = ${Number(req.params.id)}`);
  if (!existing) return res.status(404).json({ error: 'not_found', message: 'That chapter was already removed.' });
  const { title_fr = existing.title_fr, title_en = existing.title_en } = req.body ?? {};
  if (typeof title_fr !== 'string' || title_fr.trim().length < 2) {
    return res.status(400).json({ error: 'invalid', message: 'Give the chapter a title of at least 2 characters.' });
  }
  const row = one(await sql`
    UPDATE chapters SET title_fr = ${title_fr.trim()}, title_en = ${(title_en || title_fr).trim()}
     WHERE id = ${existing.id} RETURNING *`);
  res.json(row);
});

app.delete('/api/chapters/:id', requireAdmin, async (req, res) => {
  const rows = await sql`DELETE FROM chapters WHERE id = ${Number(req.params.id)} RETURNING id`;
  if (!rows.length) return res.status(404).json({ error: 'not_found', message: 'That chapter was already removed.' });
  res.json({ deleted: true });
});

/* ------------------------------------------------ exam dates */

const EXAM_KINDS = ['exam', 'td', 'tp', 'deadline', 'other'];

app.get('/api/exam-dates', async (req, res) => {
  const n = Number(req.query.semester);
  const rows = Number.isInteger(n)
    ? await sql`
        SELECT e.id, e.title_fr, e.title_en, e.date, e.kind, s.number AS semester, c.code AS course_code
          FROM exam_dates e JOIN semesters s ON s.id = e.semester_id
          LEFT JOIN courses c ON c.id = e.course_id
         WHERE s.visible = 1 AND s.number = ${n} ORDER BY e.date`
    : await sql`
        SELECT e.id, e.title_fr, e.title_en, e.date, e.kind, s.number AS semester, c.code AS course_code
          FROM exam_dates e JOIN semesters s ON s.id = e.semester_id
          LEFT JOIN courses c ON c.id = e.course_id
         WHERE s.visible = 1 ORDER BY e.date`;
  res.json(rows);
});

app.get('/api/admin/exam-dates', requireAdmin, async (_req, res) => {
  res.json(await sql`
    SELECT e.id, e.title_fr, e.title_en, e.date, e.kind, s.number AS semester, c.code AS course_code
      FROM exam_dates e JOIN semesters s ON s.id = e.semester_id
      LEFT JOIN courses c ON c.id = e.course_id
     ORDER BY e.date`);
});

app.post('/api/exam-dates', requireAdmin, async (req, res) => {
  const { semester, title_fr, title_en, date, kind = 'exam', course_code } = req.body ?? {};
  const sem = one(await sql`SELECT id FROM semesters WHERE number = ${Number(semester)}`);
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
    const c = one(await sql`SELECT id FROM courses WHERE lower(code) = lower(${course_code})`);
    courseId = c ? c.id : null;
  }
  const row = one(await sql`
    INSERT INTO exam_dates (semester_id, course_id, title_fr, title_en, date, kind)
    VALUES (${sem.id}, ${courseId}, ${title_fr.trim()}, ${(title_en || title_fr).trim()}, ${date}, ${kind})
    RETURNING *`);
  res.status(201).json(row);
});

app.delete('/api/exam-dates/:id', requireAdmin, async (req, res) => {
  const rows = await sql`DELETE FROM exam_dates WHERE id = ${Number(req.params.id)} RETURNING id`;
  if (!rows.length) return res.status(404).json({ error: 'not_found', message: 'That entry was already removed.' });
  res.json({ deleted: true });
});

/* ------------------------------------------------ AI question history (admin) */

app.get('/api/admin/ai-questions', requireAdmin, async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
  res.json(await sql`
    SELECT id, course_code, question, answer, lang, used_files, created_at
      FROM ai_questions ORDER BY created_at DESC, id DESC LIMIT ${limit}`);
});

app.delete('/api/admin/ai-questions/:id', requireAdmin, async (req, res) => {
  const rows = await sql`DELETE FROM ai_questions WHERE id = ${Number(req.params.id)} RETURNING id`;
  if (!rows.length) return res.status(404).json({ error: 'not_found', message: 'Already removed.' });
  res.json({ deleted: true });
});

/* ------------------------------------------------ module ZIP download */

app.get('/api/courses/:code/download', async (req, res) => {
  const course = one(await sql`SELECT * FROM courses WHERE lower(code) = lower(${req.params.code})`);
  if (!course) return res.status(404).json({ error: 'not_found', message: 'No module with that code.' });

  const rows = await sql`
    SELECT label, url FROM resources
     WHERE course_id = ${course.id} AND kind IN ('pdf', 'tool') AND url ~* '^https?://'
     ORDER BY position, id`;
  if (rows.length === 0) {
    return res.status(404).json({ error: 'no_files', message: 'No downloadable files for this module.' });
  }

  const { ZipArchive } = await import('archiver');
  res.attachment(`${course.code}.zip`);
  const archive = new ZipArchive({ zlib: { level: 6 } });
  archive.on('error', (err) => {
    console.error('zip error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'zip_error', message: 'Could not build the archive.' });
  });
  archive.pipe(res);
  const seen = new Set();
  for (const r of rows) {
    try {
      const resp = await fetch(r.url);
      if (!resp.ok) continue;
      const buf = Buffer.from(await resp.arrayBuffer());
      let name = decodeURIComponent(r.url.split('/').pop().split('?')[0]) || `${r.label}.pdf`;
      let i = 1;
      while (seen.has(name)) {
        const ext = path.extname(name);
        name = `${path.basename(name, ext)} (${i})${ext}`;
        i += 1;
      }
      seen.add(name);
      archive.append(buf, { name });
    } catch (err) {
      console.error('zip fetch error:', err.message);
    }
  }
  archive.finalize();
});

/* ------------------------------------------------------------ health + spa */

app.get('/api/health', (_req, res) => res.json({ ok: true, uptime: process.uptime() }));

// Local dev: serve the built front if present (on Vercel the front is served by the CDN).
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use((req, res) => res.status(404).json({ error: 'not_found', message: `No route for ${req.method} ${req.path}` }));
