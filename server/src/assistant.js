import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const MODEL = 'gemini-flash-latest';
const MAX_TOTAL_BYTES = 15 * 1024 * 1024; // stay under Gemini's 20MB inline request limit
const MAX_FILES = 12;
const MAX_OUTPUT_TOKENS = 5000;

const CATEGORY_PRIORITY = { cour: 0, td: 1, tp: 2, exams: 3 };

/** Local PDF/office resources for a course, ordered cour > td > tp > exams, capped in count and total size. */
function collectCourseFiles(course) {
  const resources = db
    .prepare("SELECT * FROM resources WHERE course_id = ? AND url LIKE '/files/%' ORDER BY position, id")
    .all(course.id);

  const withMeta = resources
    .map((r) => {
      const rel = r.url.replace(/^\/files\//, '');
      const abs = path.join(PUBLIC_DIR, ...rel.split('/').map(decodeURIComponent));
      if (!fs.existsSync(abs)) return null;
      const category = rel.split('/')[2]; // s<n>/<code>/<category>/<file>
      const stat = fs.statSync(abs);
      return { resource: r, abs, category, size: stat.size, mtimeMs: stat.mtimeMs };
    })
    .filter(Boolean)
    .sort((a, b) => (CATEGORY_PRIORITY[a.category] ?? 9) - (CATEGORY_PRIORITY[b.category] ?? 9));

  const picked = [];
  let total = 0;
  for (const f of withMeta) {
    if (picked.length >= MAX_FILES) break;
    if (total + f.size > MAX_TOTAL_BYTES) continue;
    picked.push(f);
    total += f.size;
  }
  return picked;
}

const MIME_BY_EXT = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain',
};

function getApiKeys() {
  const raw = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
  return raw
    .split(',')
    .map((k) => k.trim())
    .filter((k) => /^(AIza[\w-]{20,}|AQ\.[\w.-]{20,})$/.test(k)); // Gemini API key shapes: AIza... or AQ....
}

let nextKeyIndex = 0;

/** Rotates through all configured keys; on quota/auth errors (429/403) tries the next one. */
async function callGemini(body, keys) {
  let lastError;
  for (let attempt = 0; attempt < keys.length; attempt++) {
    const key = keys[nextKeyIndex % keys.length];
    nextKeyIndex++;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    );

    if (res.ok) return res.json();

    const text = await res.text().catch(() => '');
    lastError = new Error(`Gemini API error (${res.status}): ${text.slice(0, 300)}`);
    lastError.code = 'upstream_error';
    if (res.status !== 429 && res.status !== 403) throw lastError; // not a quota issue, no point retrying other keys
  }
  throw lastError;
}

/* ---------------------------------------------------------- File API cache
 * Uploading a PDF's base64 body on every single question is the slow part.
 * The Gemini File API lets us upload each file ONCE and reuse a small
 * "fileUri" reference afterwards — first question on a module is a bit
 * slower, every question after that (by anyone) is near-instant.
 * File refs are tied to the key/project that uploaded them, so uploads
 * always use the same primary key.
 */
const fileCache = new Map(); // abs path -> { uri, mimeType, mtimeMs, expireAt }

async function uploadToFileApi(abs, mimeType, apiKey) {
  const buffer = fs.readFileSync(abs);
  const boundary = `miv-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const metadata = JSON.stringify({ file: { displayName: path.basename(abs) } });

  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
    buffer,
    Buffer.from(`\r\n--${boundary}--`),
  ]);

  const res = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Protocol': 'multipart',
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  if (!res.ok) throw new Error(`File API upload failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const { file } = await res.json();
  return file; // { uri, mimeType, state, expirationTime, ... }
}

async function getCachedFileRef(abs, mimeType, mtimeMs, apiKey) {
  const cached = fileCache.get(abs);
  if (cached && cached.mtimeMs === mtimeMs && cached.expireAt > Date.now() + 5 * 60 * 1000) {
    return cached;
  }
  const file = await uploadToFileApi(abs, mimeType, apiKey);
  const entry = {
    uri: file.uri,
    mimeType: file.mimeType || mimeType,
    mtimeMs,
    expireAt: file.expirationTime ? Date.parse(file.expirationTime) : Date.now() + 47 * 60 * 60 * 1000,
  };
  fileCache.set(abs, entry);
  return entry;
}

async function buildFileDataParts(course, apiKey) {
  const files = collectCourseFiles(course);
  const parts = [];
  for (const f of files) {
    const ext = path.extname(f.abs).toLowerCase();
    const mimeType = MIME_BY_EXT[ext];
    if (!mimeType) continue;
    const ref = await getCachedFileRef(f.abs, mimeType, f.mtimeMs, apiKey);
    parts.push({ fileData: { mimeType: ref.mimeType, fileUri: ref.uri } });
  }
  return { parts, usedCount: parts.length };
}

function buildInlineParts(course) {
  const files = collectCourseFiles(course);
  const parts = [];
  for (const f of files) {
    const ext = path.extname(f.abs).toLowerCase();
    const mimeType = MIME_BY_EXT[ext];
    if (!mimeType) continue;
    parts.push({ inlineData: { mimeType, data: fs.readFileSync(f.abs).toString('base64') } });
  }
  return { parts, usedCount: parts.length };
}

function buildInstructions({ course, chapters, question, lang, usedCount }) {
  const title = lang === 'en' ? course.title_en : course.title_fr;
  const chapterList = chapters.map((c) => (lang === 'en' ? c.title_en : c.title_fr)).join(', ');
  return `Tu es l'assistant pédagogique du module "${title}" (${course.code}) du Master Informatique Visuelle (USTHB).
Chapitres du programme : ${chapterList || 'non précisés'}.
${usedCount > 0 ? `Des documents du cours (PDF) sont joints ci-dessous : utilise-les en priorité pour répondre.` : "Aucun document n'a pu être joint pour ce module ; réponds avec tes connaissances générales sur le sujet."}
Réponds en ${lang === 'en' ? 'anglais' : 'français'}, sur un ton professionnel et posé, comme un enseignant s'adressant à un étudiant de master. Si la question sort du cadre du module, dis-le poliment puis réponds quand même du mieux possible.
N'utilise aucune mise en forme markdown (pas d'astérisques, pas de **gras**, pas de listes à puces avec -, pas de dièses #). Écris en texte brut, en phrases complètes et bien construites, organisées en paragraphes si besoin.

Question de l'étudiant : ${question}`;
}

function extractAnswer(data) {
  return data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? null;
}

export async function askAssistant({ course, chapters, question, lang }) {
  const keys = getApiKeys();
  if (keys.length === 0) {
    const err = new Error('missing_key');
    err.code = 'missing_key';
    throw err;
  }

  // Fast path: cached File API refs, tiny request payload, primary key only.
  try {
    const { parts, usedCount } = await buildFileDataParts(course, keys[0]);
    const instructions = buildInstructions({ course, chapters, question, lang, usedCount });
    const body = {
      contents: [{ role: 'user', parts: [...parts, { text: instructions }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: MAX_OUTPUT_TOKENS },
    };
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${keys[0]}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    );
    if (res.ok) {
      const answer = extractAnswer(await res.json());
      if (answer) return { answer, usedFiles: usedCount };
    }
    // fall through to the slower, more resilient inline path below
  } catch {
    // fall through
  }

  // Fallback: inline base64 + full key rotation (slower, but works even if
  // the File API path or the primary key is unavailable).
  const { parts, usedCount } = buildInlineParts(course);
  const instructions = buildInstructions({ course, chapters, question, lang, usedCount });
  const body = {
    contents: [{ role: 'user', parts: [...parts, { text: instructions }] }],
    generationConfig: { temperature: 0.4, maxOutputTokens: MAX_OUTPUT_TOKENS },
  };
  const data = await callGemini(body, keys);
  const answer = extractAnswer(data);
  if (!answer) {
    const err = new Error('empty_response');
    err.code = 'empty_response';
    throw err;
  }
  return { answer, usedFiles: usedCount };
}
