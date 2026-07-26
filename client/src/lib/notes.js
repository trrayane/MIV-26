/** Private per-chapter study notes, kept locally — never sent to the server. */
const KEY = 'miv.notes.v1';

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

export function getNote(courseCode, chapterId) {
  return readAll()[courseCode]?.[chapterId] || '';
}

export function setNote(courseCode, chapterId, text) {
  const all = readAll();
  const course = { ...(all[courseCode] || {}) };
  if (text.trim()) course[chapterId] = text;
  else delete course[chapterId];
  localStorage.setItem(KEY, JSON.stringify({ ...all, [courseCode]: course }));
}
