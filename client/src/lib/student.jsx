import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api, getStudentToken, setStudentToken } from './api.js';

/* localStorage keys owned by the personal-study features (progress / bookmarks / notes). */
const KEYS = {
  progress: 'miv.progress.v1',
  bookmarks: 'miv.bookmarks.v1',
  notes: 'miv.notes.v1',
};
const CHANGE_EVENTS = ['miv-progress-change', 'miv-bookmarks-change', 'miv-notes-change'];

function readKey(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || {};
  } catch {
    return {};
  }
}

/** Current on-device state as one object, ready to push to the account. */
function snapshot() {
  return { progress: readKey(KEYS.progress), bookmarks: readKey(KEYS.bookmarks), notes: readKey(KEYS.notes) };
}

/** Shallow-per-course union so signing in never loses what's already on the device or the account. */
function mergeMaps(local = {}, server = {}) {
  const out = { ...server };
  for (const [course, inner] of Object.entries(local)) {
    out[course] = { ...(server[course] || {}), ...inner };
  }
  return out;
}

function mergeState(local, server) {
  return {
    progress: mergeMaps(local.progress, server.progress),
    bookmarks: { ...(server.bookmarks || {}), ...(local.bookmarks || {}) },
    notes: mergeMaps(local.notes, server.notes),
  };
}

/** Write a merged state back to localStorage and notify the UI so it re-reads. */
function applyState(state) {
  if (state.progress) localStorage.setItem(KEYS.progress, JSON.stringify(state.progress));
  if (state.bookmarks) localStorage.setItem(KEYS.bookmarks, JSON.stringify(state.bookmarks));
  if (state.notes) localStorage.setItem(KEYS.notes, JSON.stringify(state.notes));
  CHANGE_EVENTS.forEach((e) => window.dispatchEvent(new Event(e)));
}

const StudentContext = createContext(null);

export function StudentProvider({ children }) {
  const [student, setStudent] = useState(null); // { email, name } when signed in
  const [ready, setReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const tokenRef = useRef(getStudentToken());
  const pushTimer = useRef(null);

  const pushNow = useCallback(async () => {
    if (!tokenRef.current) return;
    setSyncing(true);
    try {
      await api.saveStudentData(tokenRef.current, snapshot());
    } catch {
      /* offline or expired — the next change will retry */
    } finally {
      setSyncing(false);
    }
  }, []);

  const schedulePush = useCallback(() => {
    if (!tokenRef.current) return;
    clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(pushNow, 800);
  }, [pushNow]);

  // Restore an existing session on load and pull the account's saved state.
  useEffect(() => {
    const token = tokenRef.current;
    if (!token) {
      setReady(true);
      return;
    }
    api
      .studentMe(token)
      .then(({ student: s, data }) => {
        setStudent(s);
        applyState(mergeState(snapshot(), data || {}));
        pushNow();
      })
      .catch((err) => {
        if (err.status === 401) {
          setStudentToken(null);
          tokenRef.current = null;
        }
      })
      .finally(() => setReady(true));
  }, [pushNow]);

  // While signed in, push local changes to the account (debounced).
  useEffect(() => {
    const onChange = () => schedulePush();
    CHANGE_EVENTS.forEach((e) => window.addEventListener(e, onChange));
    return () => CHANGE_EVENTS.forEach((e) => window.removeEventListener(e, onChange));
  }, [schedulePush]);

  const finishAuth = ({ token, student: s, data }) => {
    setStudentToken(token);
    tokenRef.current = token;
    setStudent(s);
    const merged = mergeState(snapshot(), data || {});
    applyState(merged);
    pushNow();
  };

  const login = async (email, password) => finishAuth(await api.studentLogin(email, password));
  const register = async (email, password, name) => finishAuth(await api.studentRegister(email, password, name));

  const logout = () => {
    setStudentToken(null);
    tokenRef.current = null;
    setStudent(null);
    // Local data stays on the device; it just stops syncing.
  };

  return (
    <StudentContext.Provider value={{ student, ready, syncing, login, register, logout }}>
      {children}
    </StudentContext.Provider>
  );
}

export function useStudent() {
  const ctx = useContext(StudentContext);
  if (!ctx) throw new Error('useStudent must be used within StudentProvider');
  return ctx;
}
