import { motion } from 'framer-motion';
import { ArrowUpRight, BookMarked, Clock3, ListTree, Star } from 'lucide-react';
import { useLang } from '../lib/i18n.jsx';
import { isBookmarked, toggleBookmark, useBookmarksVersion } from '../lib/bookmarks.js';
import { courseProgress, useProgressVersion } from '../lib/progress.js';
import { LoadBar, ProgressBar, formatHours, unitToken } from './ui.jsx';

export default function CourseCard({ course, index = 0, onOpen }) {
  const { t, pick } = useLang();
  const token = unitToken(course.unit?.type);
  const primary = course.drive_url || course.resources?.[0]?.url;
  const chapterIds = course.chapters?.map((c) => c.id) ?? [];

  useProgressVersion();
  const progress = courseProgress(course.code, chapterIds);

  useBookmarksVersion();
  const bookmarked = isBookmarked(course.code);

  const metrics = [
    { icon: Star, value: course.credits, label: t('card.credits') },
    { icon: Clock3, value: course.vhs, label: t('card.hours') },
    { icon: ListTree, value: course.chapters?.length ?? 0, label: t('card.chapters') },
  ];

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: Math.min(index * 0.04, 0.3), ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4 }}
      className="card group relative flex flex-col overflow-hidden p-5 transition-shadow duration-300 hover:border-azure/40 hover:shadow-lift"
    >
      <span className={`absolute inset-x-0 top-0 h-0.5 ${token.bar} opacity-0 transition-opacity duration-300 group-hover:opacity-100`} />

      {chapterIds.length > 0 && (
        <div className="mb-4">
          <ProgressBar value={progress} label={t('card.progress')} />
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`chip ${token.bg} ${token.text}`}>{course.code}</span>
            <span className="chip bg-canvas text-muted">{course.unit?.code}</span>
          </div>
          <h3 className="mt-3 font-display text-[17px] font-semibold leading-snug tracking-tight">
            {pick(course, 'title')}
          </h3>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => toggleBookmark(course.code)}
            aria-pressed={bookmarked}
            aria-label={bookmarked ? t('card.unbookmark') : t('card.bookmark')}
            title={bookmarked ? t('card.unbookmark') : t('card.bookmark')}
            className={`grid h-9 w-9 place-items-center rounded-xl border transition ${
              bookmarked ? 'border-azure bg-azure-soft text-azure' : 'border-hair text-muted hover:border-azure hover:text-azure'
            }`}
          >
            <Star className="h-4 w-4" strokeWidth={1.8} fill={bookmarked ? 'currentColor' : 'none'} />
          </button>
          <span className={`grid h-9 w-9 place-items-center rounded-xl ${token.bg} ${token.text}`}>
            <BookMarked className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
          </span>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2">
        {metrics.map(({ icon: Icon, value, label }) => (
          <div key={label} className="rounded-xl bg-canvas/70 px-2.5 py-2">
            <dt className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-[.12em] text-muted">
              <Icon className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
              {label}
            </dt>
            <dd className="mt-0.5 font-display text-base font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between font-mono text-[10px] uppercase tracking-[.14em] text-muted">
          <span>{t('sem.load')}</span>
          <span className="tabular-nums">{formatHours(course.h_c + course.h_td + course.h_tp)}</span>
        </div>
        <LoadBar c={course.h_c} td={course.h_td} tp={course.h_tp} />
      </div>

      <div className="mt-5 flex items-center gap-2 pt-1">
        {primary ? (
          <button type="button" onClick={() => onOpen(course, true)} className="btn-primary flex-1 text-[13px]">
            {t('card.open')}
            <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
          </button>
        ) : (
          <span className="btn flex-1 cursor-default border border-dashed border-hair text-[13px] text-muted">
            {t('card.noResources')}
          </span>
        )}
        <button type="button" onClick={() => onOpen(course, false)} className="btn-ghost px-3 text-[13px]">
          {t('card.details')}
        </button>
      </div>
    </motion.article>
  );
}
