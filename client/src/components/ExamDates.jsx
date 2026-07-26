import { useEffect, useState } from 'react';
import { CalendarDays, Plus, Trash2, X } from 'lucide-react';
import { api } from '../lib/api.js';
import { useLang } from '../lib/i18n.jsx';
import { useStudent } from '../lib/student.jsx';
import { addDeadline, listDeadlines, removeDeadline, useDeadlinesVersion } from '../lib/deadlines.js';
import ModulePicker from './ModulePicker.jsx';
import DatePicker from './DatePicker.jsx';
import SignInGate from './SignInGate.jsx';

/** Whole days from today (local midnight) until an ISO date string (YYYY-MM-DD). */
function daysUntil(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${dateStr}T00:00:00`);
  return Math.round((target - today) / (24 * 60 * 60 * 1000));
}

const KIND_STYLE = {
  exam: 'bg-signal/15 text-signal',
  deadline: 'bg-azure-soft text-azure',
  td: 'bg-iris-soft text-iris',
  tp: 'bg-aqua-soft text-aqua',
  other: 'bg-canvas text-muted',
};

function AddDeadlineForm({ courses, onAdded, onClose }) {
  const { t } = useLang();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [courseCode, setCourseCode] = useState('');

  const submit = (e) => {
    e.preventDefault();
    if (!title.trim() || !date) return;
    addDeadline({ title, date, course_code: courseCode || null });
    onAdded();
  };

  return (
    <form onSubmit={submit} className="mt-3 space-y-2 rounded-xl border border-hair bg-surface p-3">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t('exams.titlePlaceholder')}
        className="field text-sm"
        autoFocus
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <DatePicker value={date} onChange={setDate} />
        {courses?.length > 0 && (
          <ModulePicker courses={courses} code={courseCode} onChange={setCourseCode} placeholder={t('exams.noCourse')} />
        )}
      </div>
      <div className="flex items-center gap-2">
        <button type="submit" disabled={!title.trim() || !date} className="btn-primary flex-1 text-sm">
          {t('exams.add')}
        </button>
        <button type="button" onClick={onClose} className="btn-ghost text-sm">
          {t('detail.close')}
        </button>
      </div>
    </form>
  );
}

/** "Prochaines échéances" — official exam dates + personal deadlines, merged and sorted, scoped to the active semester. */
export default function ExamDates({ semester, courses }) {
  const { t, pick } = useLang();
  const { student, openAuth } = useStudent();
  const [rows, setRows] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  useDeadlinesVersion();

  useEffect(() => {
    api
      .examDates(semester && semester !== 0 ? semester : undefined)
      .then(setRows)
      .catch(() => setRows([]));
  }, [semester]);

  if (!rows) return null;

  const personal = listDeadlines()
    .filter((d) => !d.course_code || !courses || courses.some((c) => c.code === d.course_code))
    .map((d) => ({ ...d, title_fr: d.title, title_en: d.title, source: 'personal' }));

  const combined = [...rows, ...personal];
  const upcoming = combined
    .filter((r) => daysUntil(r.date) >= 0)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(0, 8);

  const countdown = (n) => {
    if (n === 0) return t('exams.today');
    if (n === 1) return t('exams.tomorrow');
    return t('exams.inDays').replace('{n}', n);
  };

  const fmtDate = (d) =>
    new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

  const toggleForm = () => {
    if (!student) return openAuth();
    setFormOpen((o) => !o);
  };

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-azure-soft text-azure">
            <CalendarDays className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-display text-base font-semibold tracking-tight">{t('exams.title')}</h2>
            <p className="font-mono text-xs uppercase tracking-[.14em] text-muted">{t('exams.subtitle')}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={toggleForm}
          aria-label={t('exams.add')}
          className="btn-ghost shrink-0 p-2"
        >
          {formOpen ? <X className="h-4 w-4" strokeWidth={2} /> : <Plus className="h-4 w-4" strokeWidth={2} />}
        </button>
      </div>

      {formOpen && !student && (
        <div className="mt-3">
          <SignInGate label={t('exams.signInHint')} />
        </div>
      )}
      {formOpen && student && (
        <AddDeadlineForm courses={courses} onClose={() => setFormOpen(false)} onAdded={() => setFormOpen(false)} />
      )}

      {upcoming.length === 0 ? (
        <p className="mt-4 text-sm text-muted">{t('exams.empty')}</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {upcoming.map((r) => {
            const n = daysUntil(r.date);
            const soon = n <= 7;
            return (
              <li key={r.id} className="flex items-center gap-3 rounded-xl border border-hair bg-surface px-3 py-2.5">
                <span className={`chip shrink-0 ${KIND_STYLE[r.kind] ?? KIND_STYLE.other}`}>
                  {t(`examkind.${r.kind}`) ?? r.kind}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {pick(r, 'title')}
                    {r.course_code ? <span className="text-muted"> · {r.course_code}</span> : null}
                  </span>
                  <span className="block font-mono text-xs uppercase tracking-[.12em] text-muted">{fmtDate(r.date)}</span>
                </span>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 font-mono text-xs font-semibold tabular-nums ${
                    soon ? 'bg-signal/15 text-signal' : 'bg-canvas text-muted'
                  }`}
                >
                  {countdown(n)}
                </span>
                {r.source === 'personal' && (
                  <button
                    type="button"
                    onClick={() => removeDeadline(r.id)}
                    aria-label={t('admin.delete')}
                    className="shrink-0 rounded-lg p-1.5 text-muted transition hover:bg-canvas hover:text-azure-deep"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
