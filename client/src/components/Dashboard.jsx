import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { PlayCircle } from 'lucide-react';
import { useLang } from '../lib/i18n.jsx';
import { courseDoneCount, useProgressVersion } from '../lib/progress.js';
import { getLastViewed, useRecentVersion } from '../lib/recent.js';
import { CreditRing } from './ui.jsx';

export default function Dashboard({ curriculum, onContinue }) {
  const { t, pick } = useLang();
  useProgressVersion();
  const recentVersion = useRecentVersion();

  const courses = useMemo(() => curriculum.flatMap((s) => s.units.flatMap((u) => u.courses)), [curriculum]);

  const { doneChapters, totalChapters } = useMemo(() => {
    let done = 0;
    let total = 0;
    for (const c of courses) {
      const ids = c.chapters.map((ch) => ch.id);
      total += ids.length;
      done += courseDoneCount(c.code, ids);
    }
    return { doneChapters: done, totalChapters: total };
  }, [courses]);

  const pct = totalChapters ? doneChapters / totalChapters : 0;
  const lastCourse = useMemo(() => {
    const code = getLastViewed();
    return code ? courses.find((c) => c.code === code) : null;
  }, [courses, recentVersion]);

  if (!totalChapters) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="mx-auto mt-8 max-w-6xl px-5"
    >
      <div className="card flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <CreditRing value={Math.round(pct * 100)} max={100} suffix="%" size={92} stroke={7} label={t('dash.progress')} />
          <div className="min-w-0">
            <p className="font-mono text-xs uppercase tracking-[.18em] text-muted">{t('dash.title')}</p>
            <p className="mt-1 font-display text-lg font-semibold tabular-nums">
              {doneChapters}/{totalChapters} <span className="text-sm font-medium text-muted">{t('stats.chapters')}</span>
            </p>
          </div>
        </div>

        {lastCourse ? (
          <button
            type="button"
            onClick={() => onContinue(lastCourse)}
            className="btn-primary text-sm sm:w-auto"
          >
            <PlayCircle className="h-4 w-4" strokeWidth={2} />
            {t('dash.continue')} — {lastCourse.code} · {pick(lastCourse, 'title')}
          </button>
        ) : (
          <p className="text-sm text-muted">{t('dash.empty')}</p>
        )}
      </div>
    </motion.section>
  );
}
