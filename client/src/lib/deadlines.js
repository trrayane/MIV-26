import { useEffect, useState } from 'react';

/** Personal deadlines (project hand-ins, TP submissions…) the student adds themselves,
 * kept locally and synced to the account alongside progress/bookmarks/notes. */
const KEY = 'miv.deadlines.v1';
const EVENT = 'miv-deadlines-change';

function readAll() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function writeAll(list) {
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new Event(EVENT));
}

export function listDeadlines() {
  return readAll();
}

export function addDeadline({ title, date, course_code, kind = 'deadline' }) {
  const item = {
    id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: title.trim(),
    date,
    course_code: course_code || null,
    kind,
  };
  writeAll([...readAll(), item]);
  return item;
}

export function removeDeadline(id) {
  writeAll(readAll().filter((d) => d.id !== id));
}

export function useDeadlinesVersion() {
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
