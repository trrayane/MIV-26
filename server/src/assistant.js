const MODEL = 'gemini-flash-latest';
const MAX_TOTAL_BYTES = 15 * 1024 * 1024; // stay under Gemini's 20MB inline request limit
const MAX_FILES = 12;
const MAX_OUTPUT_TOKENS = 5000;

const CATEGORY_PRIORITY = { cour: 0, td: 1, tp: 2, exams: 3 };

const MIME_BY_EXT = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain',
};

function extFromUrl(url) {
  const clean = url.split('?')[0];
  const dot = clean.lastIndexOf('.');
  return dot === -1 ? '' : clean.slice(dot).toLowerCase();
}

/** Blob URLs look like …/s1/ALGC/cour/file-xxxx.pdf — pull the category segment for ordering. */
function categoryFromUrl(url) {
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean);
    return parts[parts.length - 2];
  } catch {
    return undefined;
  }
}

/**
 * Fetches the course's document files (from Blob), ordered cour > td > tp > exams,
 * capped in count and total size. Returns [{ url, mimeType, buffer }].
 */
async function collectCourseFiles(files) {
  const candidates = (files || [])
    .map((r) => ({ url: r.url, mimeType: MIME_BY_EXT[extFromUrl(r.url)], category: categoryFromUrl(r.url) }))
    .filter((f) => f.mimeType)
    .sort((a, b) => (CATEGORY_PRIORITY[a.category] ?? 9) - (CATEGORY_PRIORITY[b.category] ?? 9));

  const picked = [];
  let total = 0;
  for (const c of candidates) {
    if (picked.length >= MAX_FILES) break;
    try {
      const res = await fetch(c.url);
      if (!res.ok) continue;
      const buffer = Buffer.from(await res.arrayBuffer());
      if (total + buffer.length > MAX_TOTAL_BYTES) continue;
      picked.push({ url: c.url, mimeType: c.mimeType, buffer });
      total += buffer.length;
    } catch {
      /* skip unreachable file */
    }
  }
  return picked;
}

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
    if (res.status !== 429 && res.status !== 403) throw lastError;
  }
  throw lastError;
}

/* ---------------------------------------------------------- File API cache
 * Uploading a PDF's body on every question is the slow part. The Gemini File
 * API lets us upload each file ONCE (keyed by its Blob URL) and reuse a small
 * "fileUri" reference afterwards — near-instant on later questions.
 */
const fileCache = new Map(); // url -> { uri, mimeType, expireAt }

async function uploadToFileApi(url, buffer, mimeType, apiKey) {
  const boundary = `miv-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const displayName = decodeURIComponent(url.split('/').pop().split('?')[0]);
  const metadata = JSON.stringify({ file: { displayName } });

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
  return file;
}

async function getCachedFileRef(file, apiKey) {
  const cached = fileCache.get(file.url);
  if (cached && cached.expireAt > Date.now() + 5 * 60 * 1000) return cached;
  const uploaded = await uploadToFileApi(file.url, file.buffer, file.mimeType, apiKey);
  const entry = {
    uri: uploaded.uri,
    mimeType: uploaded.mimeType || file.mimeType,
    expireAt: uploaded.expirationTime ? Date.parse(uploaded.expirationTime) : Date.now() + 47 * 60 * 60 * 1000,
  };
  fileCache.set(file.url, entry);
  return entry;
}

async function buildFileDataParts(files, apiKey) {
  const parts = [];
  for (const f of files) {
    const ref = await getCachedFileRef(f, apiKey);
    parts.push({ fileData: { mimeType: ref.mimeType, fileUri: ref.uri } });
  }
  return { parts, usedCount: parts.length };
}

function buildInlineParts(files) {
  const parts = files.map((f) => ({ inlineData: { mimeType: f.mimeType, data: f.buffer.toString('base64') } }));
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

export async function askAssistant({ course, chapters, files, question, lang }) {
  const keys = getApiKeys();
  if (keys.length === 0) {
    const err = new Error('missing_key');
    err.code = 'missing_key';
    throw err;
  }

  const courseFiles = await collectCourseFiles(files);

  // Fast path: cached File API refs, tiny request payload, primary key only.
  try {
    const { parts, usedCount } = await buildFileDataParts(courseFiles, keys[0]);
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
  } catch {
    // fall through to the slower, more resilient inline path below
  }

  // Fallback: inline base64 + full key rotation.
  const { parts, usedCount } = buildInlineParts(courseFiles);
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
