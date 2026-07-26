import { useEffect, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { api } from '../lib/api.js';
import { useLang } from '../lib/i18n.jsx';

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

/** "Prochaines échéances" — upcoming exams/hand-ins with a countdown, scoped to the active semester. */
export default function ExamDates({ semester }) {
  const { t, pick } = useLang();
  const [rows, setRows] = useState(null);

  useEffect(() => {
    api
      .examDates(semester && semester !== 0 ? semester : undefined)
      .then(setRows)
      .catch(() => setRows([]));
  }, [semester]);

  if (!rows) return null;
  const upcoming = rows.filter((r) => daysUntil(r.date) >= 0).slice(0, 6);
  if (upcoming.length === 0) return null;

  const countdown = (n) => {
    if (n === 0) return t('exams.today');
    if (n === 1) return t('exams.tomorrow');
    return t('exams.inDays').replace('{n}', n);
  };

  const fmtDate = (d) =>
    new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

  return (
    <section className="card p-5">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-azure-soft text-azure">
          <CalendarDays className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-display text-base font-semibold tracking-tight">{t('exams.title')}</h2>
          <p className="font-mono text-xs uppercase tracking-[.14em] text-muted">{t('exams.subtitle')}</p>
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {upcoming.map((r) => {
          const n = daysUntil(r.date);
          const soon = n <= 7;
          return (
            <li
              key={r.id}
              className="flex items-center gap-3 rounded-xl border border-hair bg-surface px-3 py-2.5"
            >
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
            </li>
          );
        })}
      </ul>
    </section>
  );
}
