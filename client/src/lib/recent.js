import { useEffect, useState } from 'react';

/** Last module opened, for the dashboard's "continue where you left off" shortcut. */
const KEY = 'miv.lastViewed.v1';
const EVENT = 'miv-recent-change';

export function setLastViewed(courseCode) {
  localStorage.setItem(KEY, courseCode);
  window.dispatchEvent(new Event(EVENT));
}

export function getLastViewed() {
  return localStorage.getItem(KEY);
}

export function useRecentVersion() {
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
