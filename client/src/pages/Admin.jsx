import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, Check, FolderOpen, KeyRound, Link2, ListChecks, LogOut, MessageSquare, Pencil, Plus, SlidersHorizontal, Trash2, UploadCloud } from 'lucide-react';
import { api, getToken, setToken } from '../lib/api.js';
import { useLang } from '../lib/i18n.jsx';
import { KindIcon, Select, Skeleton, Toggle, unitToken } from '../components/ui.jsx';
import { groupResources } from '../lib/resourceGroups.js';

const KINDS = ['drive', 'pdf', 'video', 'course', 'tool', 'reference', 'lab', 'platform'];
const CATEGORIES = ['cour', 'td', 'tp', 'exams'];

export default function Admin() {
  const { t } = useLang();
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!getToken()) return setChecking(false);
    api
      .me()
      .then(() => setAuthed(true))
      .catch(() => setToken(null))
      .finally(() => setChecking(false));
  }, []);

  if (checking) {
    return (
      <Shell>
        <div className="mx-auto max-w-md space-y-3">
          <Skeleton className="h-11 w-11 rounded-xl" />
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </Shell>
    );
  }
  if (!authed) return <SignIn onSuccess={() => setAuthed(true)} />;
  return <Workspace onSignOut={() => { setToken(null); setAuthed(false); }} />;
}

function Shell({ children }) {
  return <div className="mx-auto max-w-6xl px-4 py-8 sm:px-5 sm:py-12">{children}</div>;
}

/* ------------------------------------------------------------- sign-in */

function SignIn({ onSuccess }) {
  const { t } = useLang();
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { token } = await api.login(password);
      setToken(token);
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell>
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="card mx-auto max-w-md p-7"
      >
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-azure-soft text-azure">
          <KeyRound className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
        </span>
        <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight">{t('admin.title')}</h1>
        <p className="mt-1.5 text-sm text-muted">{t('admin.loginIntro')}</p>

        <form onSubmit={submit} className="mt-6">
          <label className="label" htmlFor="pw">{t('admin.password')}</label>
          <input
            id="pw"
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field"
            autoComplete="current-password"
          />
          {error && <p className="mt-2 text-xs text-azure-deep">{error}</p>}
          <button type="submit" disabled={busy || !password} className="btn-primary mt-4 w-full">
            {t('admin.signin')}
          </button>
        </form>

        <Link to="/" className="mt-4 inline-block font-mono text-xs uppercase tracking-[.14em] text-muted hover:text-azure">
          {t('admin.backToHub')}
        </Link>
      </motion.div>
    </Shell>
  );
}

/* ----------------------------------------------------------- workspace */

function Workspace({ onSignOut }) {
  const { t, pick } = useLang();
  const [courses, setCourses] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [activeCode, setActiveCode] = useState(null);
  const [course, setCourse] = useState(null);
  const [courseLoading, setCourseLoading] = useState(true);
  const [notice, setNotice] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.adminCourses().then((rows) => {
      setCourses(rows);
      setCoursesLoading(false);
      if (rows.length) setActiveCode(rows[0].code);
    });
  }, []);

  useEffect(() => {
    if (!activeCode) return;
    setCourseLoading(true);
    api.course(activeCode).then((c) => {
      setCourse(c);
      setCourseLoading(false);
    });
  }, [activeCode]);

  const refresh = () => activeCode && api.course(activeCode).then(setCourse);

  const flash = (msg) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 2200);
  };

  const bySemester = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = needle
      ? courses.filter((c) => `${c.code} ${c.title_fr} ${c.title_en}`.toLowerCase().includes(needle))
      : courses;
    const map = new Map();
    for (const c of filtered) {
      if (!map.has(c.semester)) map.set(c.semester, []);
      map.get(c.semester).push(c);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [courses, search]);

  return (
    <Shell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">{t('admin.title')}</h1>
          <p className="mt-1.5 max-w-lg text-sm text-muted">{t('admin.subtitle')}</p>
        </div>
        <button type="button" onClick={onSignOut} className="btn-ghost text-sm">
          <LogOut className="h-4 w-4" strokeWidth={1.8} />
          {t('admin.signout')}
        </button>
      </div>

      <AssistantToggle onChanged={(msg) => flash(msg)} />
      <SemesterManager onChanged={(msg) => flash(msg)} />
      <AiHistory />

      <div className="mt-8 grid gap-6 lg:grid-cols-[280px_1fr] lg:items-start">
        <nav aria-label={t('admin.pickCourse')} className="card scroll-slim max-h-[45vh] overflow-y-auto p-3 lg:sticky lg:top-24 lg:max-h-[70vh]">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('admin.searchModule')}
            className="field mb-3 text-sm"
          />
          {coursesLoading && (
            <div className="space-y-2 p-1">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          )}
          {!coursesLoading && bySemester.length === 0 && (
            <p className="px-2 py-1.5 text-sm text-muted">{t('search.empty')}</p>
          )}
          {bySemester.map(([number, rows]) => (
            <div key={number} className="mb-3 last:mb-0">
              <p className="px-2 py-1.5 font-mono text-xs uppercase tracking-[.16em] text-muted">
                {t('sem.s')} {number}
              </p>
              <ul>
                {rows.map((row) => {
                  const active = row.code === activeCode;
                  return (
                    <li key={row.id}>
                      <button
                        type="button"
                        onClick={() => setActiveCode(row.code)}
                        className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm transition ${
                          active ? 'bg-azure text-white' : 'hover:bg-azure-soft'
                        }`}
                      >
                        <span className={`w-11 shrink-0 truncate font-mono text-xs font-semibold ${active ? 'text-white/80' : 'text-azure'}`}>
                          {row.code}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{pick(row, 'title')}</span>
                        <span className={`font-mono text-xs ${active ? 'text-white/70' : 'text-muted'}`}>
                          {row.resource_count}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="w-full min-w-0 space-y-6">
          {courseLoading && (
            <div className="space-y-6">
              <Skeleton className="h-24" />
              <Skeleton className="h-32" />
              <Skeleton className="h-56" />
            </div>
          )}
          {!courseLoading && course && (
            <>
              <CourseHeader course={course} />
              <ChapterManager course={course} onChanged={() => { flash(t('admin.saved')); refresh(); }} />
              <DriveField course={course} onSaved={(msg) => { flash(msg); refresh(); }} />
              <UploadFile course={course} onAdded={() => { flash(t('admin.saved')); refresh(); }} />
              <AddLink course={course} onAdded={() => { flash(t('admin.saved')); refresh(); }} />
              <LinkList course={course} onChanged={refresh} />
            </>
          )}
        </div>
      </div>

      <AnimatePresence>
        {notice && (
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm text-white shadow-lift"
          >
            <Check className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
            {notice}
          </motion.p>
        )}
      </AnimatePresence>
    </Shell>
  );
}

function AssistantToggle({ onChanged }) {
  const { t } = useLang();
  const [enabled, setEnabled] = useState(null);

  useEffect(() => { api.assistantStatus().then((s) => setEnabled(s.enabled)); }, []);

  const toggle = async () => {
    const next = !enabled;
    setEnabled(next);
    await api.setAssistantEnabled(next);
    onChanged(t('admin.saved'));
  };

  if (enabled === null) return null;

  return (
    <section className="card mt-8 flex w-full items-center p-5">
      <Toggle checked={enabled} onChange={toggle} label={t('admin.assistant')} />
      <div className="ml-3 flex-1">
        <p className="font-display text-sm font-semibold uppercase tracking-[.1em] text-muted">{t('admin.assistant')}</p>
        <p className="mt-0.5 text-xs text-muted">{t('admin.assistantHint')}</p>
      </div>
      <span className={`chip ml-3 flex-none ${enabled ? 'bg-azure-soft text-azure' : 'bg-canvas text-muted'}`}>
        {enabled ? t('admin.assistantOn') : t('admin.assistantOff')}
      </span>
    </section>
  );
}

function SemesterManager({ onChanged }) {
  const { t } = useLang();
  const [semesters, setSemesters] = useState([]);
  const [open, setOpen] = useState(null);

  const load = () => api.adminSemesters().then(setSemesters);
  useEffect(() => { load(); }, []);

  const toggle = async (number, visible) => {
    await api.setSemesterVisibility(number, visible);
    load();
    onChanged(t('admin.saved'));
  };

  return (
    <section className="card mt-8 w-full p-5">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-azure-soft text-azure">
          <SlidersHorizontal className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
        </span>
        <p className="font-display text-sm font-semibold uppercase tracking-[.1em] text-muted">{t('admin.semesters')}</p>
      </div>
      <p className="mt-1 text-xs text-muted">{t('admin.semestersHint')}</p>

      <ul className="mt-4 space-y-2">
        {semesters.map((s) => (
          <li key={s.number} className="rounded-xl border border-hair">
            <div className="flex items-center px-3 py-2.5">
              <Toggle checked={!!s.visible} onChange={() => toggle(s.number, !s.visible)} label={`${t('sem.s')} ${s.number}`} />
              <span className="ml-3 flex min-w-0 flex-1 items-center gap-2 text-sm font-medium">
                <span className="truncate">{t('sem.s')} {s.number} — {s.label_fr}</span>
                {!s.visible && (
                  <span className="chip shrink-0 bg-canvas text-muted">{t('admin.hidden')}</span>
                )}
              </span>
              <button
                type="button"
                onClick={() => setOpen(open === s.number ? null : s.number)}
                className="btn-ghost ml-2 flex-none px-3 text-xs sm:ml-3"
                title={t('admin.driveLinks')}
              >
                <FolderOpen className="h-3.5 w-3.5" strokeWidth={1.8} />
                <span className="hidden sm:inline">{t('admin.driveLinks')}</span>
              </button>
            </div>
            {open === s.number && (
              <div className="border-t border-hair p-3">
                <SemesterDriveLinks semester={s.number} onAdded={() => onChanged(t('admin.saved'))} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function CourseHeader({ course }) {
  const { pick, t } = useLang();
  const token = unitToken(course.unit?.type);
  return (
    <header className="card p-5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`chip ${token.bg} ${token.text}`}>{course.code}</span>
        <span className="chip bg-canvas text-muted">{course.unit?.code}</span>
        <span className="chip bg-canvas text-muted">
          {t('sem.s')} {course.semester}
        </span>
      </div>
      <h2 className="mt-3 font-display text-xl font-semibold tracking-tight">{pick(course, 'title')}</h2>
    </header>
  );
}

function DriveField({ course, onSaved }) {
  const { t } = useLang();
  const [value, setValue] = useState(course.drive_url || '');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => setValue(course.drive_url || ''), [course.id, course.drive_url]);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.setDrive(course.id, value.trim());
      onSaved(t('admin.saved'));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card p-5">
      <label className="label" htmlFor="drive">{t('admin.driveFolder')}</label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <FolderOpen className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" strokeWidth={1.8} aria-hidden="true" />
          <input
            id="drive"
            type="url"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="https://drive.google.com/drive/folders/…"
            className="field pl-10"
          />
        </div>
        <button type="button" onClick={save} disabled={busy} className="btn-primary sm:w-32">
          {t('admin.save')}
        </button>
      </div>
      <p className="mt-2 text-xs text-muted">{t('admin.driveHint')}</p>
      {error && <p className="mt-2 text-xs text-azure-deep">{error}</p>}
    </section>
  );
}

function UploadFile({ course, onAdded }) {
  const { t, pick } = useLang();
  const empty = { category: 'cour', chapter_id: '', label: '' };
  const [form, setForm] = useState(empty);
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setForm(empty);
    setFile(null);
  }, [course.id]);

  const submit = async (e) => {
    e.preventDefault();
    if (!file) return setError(t('admin.pickFile'));
    setBusy(true);
    setError(null);
    try {
      const data = new FormData();
      data.append('file', file);
      data.append('course_id', course.id);
      data.append('category', form.category);
      if (form.chapter_id) data.append('chapter_id', form.chapter_id);
      if (form.label) data.append('label', form.label);
      await api.uploadResource(data);
      setForm(empty);
      setFile(null);
      e.target.reset();
      onAdded();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card p-5">
      <p className="font-display text-sm font-semibold uppercase tracking-[.1em] text-muted">{t('admin.uploadFile')}</p>
      <p className="mt-1 text-xs text-muted">{t('admin.uploadHint')}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="category">{t('admin.category')}</label>
          <Select
            id="category"
            value={form.category}
            onChange={(v) => setForm({ ...form, category: v })}
            options={CATEGORIES.map((c) => ({ value: c, label: t(`group.${c}`) }))}
          />
        </div>
        <div>
          <label className="label" htmlFor="chapter-up">{t('admin.linkChapter')}</label>
          <Select
            id="chapter-up"
            value={form.chapter_id}
            onChange={(v) => setForm({ ...form, chapter_id: v })}
            options={[
              { value: '', label: t('admin.wholeCourse') },
              ...course.chapters.map((ch) => ({
                value: ch.id,
                label: `${String(ch.position).padStart(2, '0')} — ${pick(ch, 'title')}`,
              })),
            ]}
          />
        </div>
        <div>
          <label className="label" htmlFor="label-up">{t('admin.optionalName')}</label>
          <input
            id="label-up"
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            className="field"
            placeholder="Chapitre 1"
          />
        </div>
        <div>
          <label className="label" htmlFor="file">{t('admin.pickFile')}</label>
          <input
            id="file"
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="field file:mr-3 file:rounded-lg file:border-0 file:bg-azure-soft file:px-3 file:py-1.5 file:text-azure"
          />
        </div>
      </div>

      {error && <p className="mt-3 text-xs text-azure-deep">{error}</p>}

      <button type="submit" disabled={busy} className="btn-primary mt-4">
        <UploadCloud className="h-4 w-4" strokeWidth={2} />
        {busy ? t('admin.uploading') : t('admin.upload')}
      </button>
    </form>
  );
}

function SemesterDriveLinks({ semester, onAdded }) {
  const { t } = useLang();
  const empty = { label: '', url: '' };
  const [links, setLinks] = useState([]);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => api.semesterLinks(semester).then(setLinks);
  useEffect(() => {
    setForm(empty);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semester]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.createSemesterLink({ semester, label: form.label, url: form.url });
      setForm(empty);
      load();
      onAdded();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm(t('admin.confirmDelete'))) return;
    await api.deleteSemesterLink(id);
    load();
    onAdded();
  };

  return (
    <section className="card p-5">
      <p className="font-display text-sm font-semibold uppercase tracking-[.1em] text-muted">
        {t('admin.driveLinks')} · {t('sem.s')} {semester}
      </p>
      <p className="mt-1 text-xs text-muted">{t('admin.driveLinksHint')}</p>

      {links.length > 0 && (
        <ul className="mt-4 space-y-2">
          {links.map((l) => (
            <li key={l.id} className="flex items-center gap-3 rounded-xl border border-hair px-3 py-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-azure-soft text-azure">
                <KindIcon kind="drive" className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{l.label}</p>
                <p className="truncate font-mono text-xs text-muted">{l.url}</p>
              </div>
              <button
                type="button"
                onClick={() => remove(l.id)}
                aria-label={t('admin.delete')}
                className="rounded-lg p-2 text-muted transition hover:bg-azure-soft hover:text-azure"
              >
                <Trash2 className="h-4 w-4" strokeWidth={1.8} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="drive-label">{t('admin.linkName')}</label>
          <input
            id="drive-label"
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            className="field"
            placeholder="Drive — Cours complet"
          />
        </div>
        <div>
          <label className="label" htmlFor="drive-url">{t('admin.linkUrl')}</label>
          <input
            id="drive-url"
            type="url"
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            className="field"
            placeholder="https://drive.google.com/drive/folders/…"
          />
        </div>

        {error && <p className="sm:col-span-2 text-xs text-azure-deep">{error}</p>}

        <button type="submit" disabled={busy} className="btn-primary sm:col-span-2">
          <Plus className="h-4 w-4" strokeWidth={2} />
          {t('admin.addDriveLink')}
        </button>
      </form>
    </section>
  );
}

function AddLink({ course, onAdded }) {
  const { t, pick } = useLang();
  const empty = { label: '', url: '', kind: 'drive', chapter_id: '' };
  const [form, setForm] = useState(empty);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => setForm(empty), [course.id]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.createResource({
        course_id: course.id,
        chapter_id: form.chapter_id ? Number(form.chapter_id) : null,
        label: form.label,
        url: form.url,
        kind: form.kind,
      });
      setForm(empty);
      onAdded();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card p-5">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-azure-soft text-azure">
          <Link2 className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
        </span>
        <p className="font-display text-sm font-semibold uppercase tracking-[.1em] text-muted">{t('admin.addLink')}</p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="label">{t('admin.linkName')}</label>
          <input
            id="label"
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            className="field"
            placeholder="Cours 01 — Introduction"
          />
        </div>
        <div>
          <label className="label" htmlFor="url">{t('admin.linkUrl')}</label>
          <input
            id="url"
            type="url"
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            className="field"
            placeholder="https://drive.google.com/file/d/…"
          />
        </div>
        <div>
          <label className="label" htmlFor="kind">{t('admin.linkKind')}</label>
          <Select
            id="kind"
            value={form.kind}
            onChange={(v) => setForm({ ...form, kind: v })}
            options={KINDS.map((k) => ({ value: k, label: t(`kind.${k}`) }))}
          />
        </div>
        <div>
          <label className="label" htmlFor="chapter">{t('admin.linkChapter')}</label>
          <Select
            id="chapter"
            value={form.chapter_id}
            onChange={(v) => setForm({ ...form, chapter_id: v })}
            options={[
              { value: '', label: t('admin.wholeCourse') },
              ...course.chapters.map((ch) => ({
                value: ch.id,
                label: `${String(ch.position).padStart(2, '0')} — ${pick(ch, 'title')}`,
              })),
            ]}
          />
        </div>
      </div>

      {error && <p className="mt-3 text-xs text-azure-deep">{error}</p>}

      <button type="submit" disabled={busy} className="btn-primary mt-4">
        <Plus className="h-4 w-4" strokeWidth={2} />
        {t('admin.addLink')}
      </button>
    </form>
  );
}

function LinkList({ course, onChanged }) {
  const { t, pick } = useLang();
  const chapterName = (id) => {
    const ch = course.chapters.find((c) => c.id === id);
    return ch ? `${String(ch.position).padStart(2, '0')} — ${pick(ch, 'title')}` : t('admin.wholeCourse');
  };

  const remove = async (id) => {
    if (!window.confirm(t('admin.confirmDelete'))) return;
    await api.deleteResource(id);
    onChanged();
  };

  const groups = groupResources(course.resources);

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-azure-soft text-azure">
            <ListChecks className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
          </span>
          <p className="font-display text-sm font-semibold uppercase tracking-[.1em] text-muted">{t('admin.existing')}</p>
        </div>
        <span className="font-mono text-xs tabular-nums text-muted">{course.resources.length}</span>
      </div>

      {course.resources.length === 0 ? (
        <p className="mt-4 text-sm text-muted">{t('admin.empty')}</p>
      ) : (
        <div className="mt-4 space-y-5">
          {groups.map(([key, list]) => (
            <div key={key}>
              <p className="mb-2 flex items-center gap-2 font-mono text-xs uppercase tracking-[.14em] text-azure">
                <KindIcon kind={key === 'drive' ? 'drive' : list[0].kind} className="h-3.5 w-3.5" />
                {t(`group.${key}`)}
                <span className="text-muted">· {list.length}</span>
              </p>
              <ul className="space-y-2">
                {list.map((r) => (
                  <EditableResource
                    key={r.id}
                    resource={r}
                    course={course}
                    chapterName={chapterName}
                    onRemove={() => remove(r.id)}
                    onChanged={onChanged}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function EditableResource({ resource, course, chapterName, onRemove, onChanged }) {
  const { t, pick } = useLang();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ label: resource.label, url: resource.url, kind: resource.kind, chapter_id: resource.chapter_id ?? '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.updateResource(resource.id, {
        label: form.label,
        url: form.url,
        kind: form.kind,
        chapter_id: form.chapter_id ? Number(form.chapter_id) : null,
      });
      setEditing(false);
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <li className="rounded-xl border border-azure/40 bg-azure-soft/30 p-3">
        <form onSubmit={save} className="grid gap-2.5 sm:grid-cols-2">
          <input
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            className="field sm:col-span-2"
            placeholder={t('admin.linkName')}
          />
          <input
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            className="field sm:col-span-2"
            placeholder={t('admin.linkUrl')}
          />
          <Select
            value={form.kind}
            onChange={(v) => setForm({ ...form, kind: v })}
            options={KINDS.map((k) => ({ value: k, label: t(`kind.${k}`) }))}
          />
          <Select
            value={form.chapter_id}
            onChange={(v) => setForm({ ...form, chapter_id: v })}
            options={[
              { value: '', label: t('admin.wholeCourse') },
              ...course.chapters.map((ch) => ({
                value: ch.id,
                label: `${String(ch.position).padStart(2, '0')} — ${pick(ch, 'title')}`,
              })),
            ]}
          />
          {error && <p className="text-xs text-azure-deep sm:col-span-2">{error}</p>}
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" disabled={busy} className="btn-primary flex-1 text-sm">
              <Check className="h-4 w-4" strokeWidth={2} />
              {t('admin.save')}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="btn-ghost text-sm">
              {t('admin.cancel')}
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3 rounded-xl border border-hair px-3 py-2.5">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-azure-soft text-azure">
        <KindIcon kind={resource.kind} className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{resource.label}</p>
        <p className="truncate font-mono text-xs text-muted">
          {chapterName(resource.chapter_id)} · {resource.url}
        </p>
      </div>
      {resource.origin === 'seeded' && (
        <span className="chip hidden bg-canvas text-muted sm:inline-flex">{t('admin.seeded')}</span>
      )}
      <button
        type="button"
        onClick={() => { setForm({ label: resource.label, url: resource.url, kind: resource.kind, chapter_id: resource.chapter_id ?? '' }); setEditing(true); }}
        aria-label={t('admin.edit')}
        title={t('admin.edit')}
        className="rounded-lg p-2 text-muted transition hover:bg-azure-soft hover:text-azure"
      >
        <Pencil className="h-4 w-4" strokeWidth={1.8} />
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label={t('admin.delete')}
        title={t('admin.delete')}
        className="rounded-lg p-2 text-muted transition hover:bg-azure-soft hover:text-azure"
      >
        <Trash2 className="h-4 w-4" strokeWidth={1.8} />
      </button>
    </li>
  );
}

/* ------------------------------------------------------------- chapters */

function ChapterManager({ course, onChanged }) {
  const { t } = useLang();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ title_fr: '', title_en: '' });
  const [busy, setBusy] = useState(false);

  const add = async (e) => {
    e.preventDefault();
    if (!draft.title_fr.trim()) return;
    setBusy(true);
    try {
      await api.createChapter(course.id, { title_fr: draft.title_fr, title_en: draft.title_en || draft.title_fr });
      setDraft({ title_fr: '', title_en: '' });
      setAdding(false);
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm(t('admin.confirmDeleteChapter'))) return;
    await api.deleteChapter(id);
    onChanged();
  };

  return (
    <section className="card p-5">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-azure-soft text-azure">
          <BookOpen className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
        </span>
        <p className="font-display text-sm font-semibold uppercase tracking-[.1em] text-muted">{t('admin.chapters')}</p>
        <span className="ml-auto font-mono text-xs tabular-nums text-muted">{course.chapters.length}</span>
      </div>
      <p className="mt-1 text-xs text-muted">{t('admin.chaptersHint')}</p>

      {course.chapters.length === 0 ? (
        <p className="mt-4 text-sm text-muted">{t('admin.noChapters')}</p>
      ) : (
        <ol className="mt-4 space-y-2">
          {course.chapters.map((ch) => (
            <ChapterItem key={ch.id} chapter={ch} onRemove={() => remove(ch.id)} onChanged={onChanged} />
          ))}
        </ol>
      )}

      {adding ? (
        <form onSubmit={add} className="mt-3 grid gap-2.5 rounded-xl border border-azure/40 bg-azure-soft/30 p-3 sm:grid-cols-2">
          <input
            autoFocus
            value={draft.title_fr}
            onChange={(e) => setDraft({ ...draft, title_fr: e.target.value })}
            className="field"
            placeholder={t('admin.chapterTitle')}
          />
          <input
            value={draft.title_en}
            onChange={(e) => setDraft({ ...draft, title_en: e.target.value })}
            className="field"
            placeholder={t('admin.chapterTitleEn')}
          />
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" disabled={busy || !draft.title_fr.trim()} className="btn-primary flex-1 text-sm">
              <Check className="h-4 w-4" strokeWidth={2} />
              {t('admin.save')}
            </button>
            <button type="button" onClick={() => setAdding(false)} className="btn-ghost text-sm">
              {t('admin.cancel')}
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="btn-ghost mt-3 text-sm">
          <Plus className="h-4 w-4" strokeWidth={2} />
          {t('admin.addChapter')}
        </button>
      )}
    </section>
  );
}

function ChapterItem({ chapter, onRemove, onChanged }) {
  const { t, pick } = useLang();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ title_fr: chapter.title_fr, title_en: chapter.title_en });
  const [busy, setBusy] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.updateChapter(chapter.id, form);
      setEditing(false);
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <li className="rounded-xl border border-azure/40 bg-azure-soft/30 p-3">
        <form onSubmit={save} className="grid gap-2.5 sm:grid-cols-2">
          <input value={form.title_fr} onChange={(e) => setForm({ ...form, title_fr: e.target.value })} className="field" placeholder={t('admin.chapterTitle')} />
          <input value={form.title_en} onChange={(e) => setForm({ ...form, title_en: e.target.value })} className="field" placeholder={t('admin.chapterTitleEn')} />
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" disabled={busy} className="btn-primary flex-1 text-sm">
              <Check className="h-4 w-4" strokeWidth={2} />
              {t('admin.save')}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="btn-ghost text-sm">{t('admin.cancel')}</button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3 rounded-xl border border-hair px-3 py-2.5">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-azure-soft font-mono text-xs font-semibold text-azure">
        {String(chapter.position).padStart(2, '0')}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{pick(chapter, 'title')}</span>
      <button type="button" onClick={() => { setForm({ title_fr: chapter.title_fr, title_en: chapter.title_en }); setEditing(true); }} aria-label={t('admin.edit')} title={t('admin.edit')} className="rounded-lg p-2 text-muted transition hover:bg-azure-soft hover:text-azure">
        <Pencil className="h-4 w-4" strokeWidth={1.8} />
      </button>
      <button type="button" onClick={onRemove} aria-label={t('admin.delete')} title={t('admin.delete')} className="rounded-lg p-2 text-muted transition hover:bg-azure-soft hover:text-azure">
        <Trash2 className="h-4 w-4" strokeWidth={1.8} />
      </button>
    </li>
  );
}

/* ------------------------------------------------------------- AI history */

function AiHistory() {
  const { t } = useLang();
  const [rows, setRows] = useState(null);
  const [openId, setOpenId] = useState(null);

  const load = () => api.aiQuestions(100).then(setRows).catch(() => setRows([]));
  useEffect(() => { load(); }, []);

  const remove = async (id) => {
    if (!window.confirm(t('admin.confirmDelete'))) return;
    await api.deleteAiQuestion(id);
    load();
  };

  return (
    <section className="card mt-8 p-5">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-azure-soft text-azure">
          <MessageSquare className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
        </span>
        <p className="font-display text-sm font-semibold uppercase tracking-[.1em] text-muted">{t('admin.aiHistory')}</p>
        {rows && <span className="ml-auto font-mono text-xs tabular-nums text-muted">{rows.length}</span>}
      </div>
      <p className="mt-1 text-xs text-muted">{t('admin.aiHistoryHint')}</p>

      {!rows ? (
        <div className="mt-4 space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
        </div>
      ) : rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted">{t('admin.aiEmpty')}</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {rows.map((r) => {
            const open = openId === r.id;
            return (
              <li key={r.id} className="rounded-xl border border-hair p-3">
                <div className="flex items-start gap-3">
                  <span className="chip mt-0.5 shrink-0 bg-azure-soft text-azure">{r.course_code}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{r.question}</p>
                    <p className="mt-0.5 font-mono text-xs text-muted">{r.created_at}</p>
                    {open && r.answer && (
                      <p className="mt-2 whitespace-pre-wrap rounded-lg bg-canvas p-3 text-sm leading-relaxed text-muted">{r.answer}</p>
                    )}
                    {r.answer && (
                      <button type="button" onClick={() => setOpenId(open ? null : r.id)} className="mt-2 font-mono text-xs uppercase tracking-[.12em] text-azure hover:underline">
                        {open ? t('admin.aiHideAnswer') : t('admin.aiShowAnswer')}
                      </button>
                    )}
                  </div>
                  <button type="button" onClick={() => remove(r.id)} aria-label={t('admin.delete')} title={t('admin.delete')} className="rounded-lg p-2 text-muted transition hover:bg-azure-soft hover:text-azure">
                    <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
