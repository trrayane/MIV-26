import { useEffect, useState } from 'react';

/** Starred modules, kept locally so they float to the top of their semester. */
const KEY = 'miv.bookmarks.v1';
const EVENT = 'miv-bookmarks-change';

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

export function isBookmarked(courseCode) {
  return Boolean(readAll()[courseCode]);
}

export function toggleBookmark(courseCode) {
  const all = readAll();
  const copy = { ...all };
  if (copy[courseCode]) delete copy[courseCode];
  else copy[courseCode] = true;
  writeAll(copy);
}

export function useBookmarksVersion() {
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
