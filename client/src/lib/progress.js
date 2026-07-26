import { useEffect, useState } from 'react';

/** Per-browser chapter checklist. Nothing here touches the server — it's a personal study tracker. */
const KEY = 'miv.progress.v1';
const EVENT = 'miv-progress-change';

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

function writeAll(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
  window.dispatchEvent(new Event(EVENT));
}

export function isChapterDone(courseCode, chapterId) {
  return Boolean(readAll()[courseCode]?.[chapterId]);
}

export function toggleChapter(courseCode, chapterId) {
  const all = readAll();
  const done = { ...(all[courseCode] || {}) };
  if (done[chapterId]) delete done[chapterId];
  else done[chapterId] = true;
  writeAll({ ...all, [courseCode]: done });
}

export function courseProgress(courseCode, chapterIds) {
  if (!chapterIds.length) return 0;
  const done = readAll()[courseCode] || {};
  return chapterIds.filter((id) => done[id]).length / chapterIds.length;
}

export function courseDoneCount(courseCode, chapterIds) {
  const done = readAll()[courseCode] || {};
  return chapterIds.filter((id) => done[id]).length;
}

/** Bumps on every checklist change so components re-read localStorage and re-render. */
export function useProgressVersion() {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    window.addEventListener(EVENT, bump);
    window.addEventListener('storage', bump);
    return () => {
      window.removeEventListener(EVENT, bump);
      window.removeEventListener('storage', bump);
    };
  }, []);
  return version;
}
