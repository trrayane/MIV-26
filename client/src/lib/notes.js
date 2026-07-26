/** Per-chapter study notes, kept locally and (when signed in) synced to the account. */
const KEY = 'miv.notes.v1';
const EVENT = 'miv-notes-change';

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
  window.dispatchEvent(new Event(EVENT));
}
