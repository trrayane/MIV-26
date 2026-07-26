import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpRight, Check, GraduationCap, PenLine, PercentCircle, Users, X } from 'lucide-react';
import { useLang } from '../lib/i18n.jsx';
import { getNote, setNote } from '../lib/notes.js';
import { courseDoneCount, isChapterDone, toggleChapter, useProgressVersion } from '../lib/progress.js';
import { KindIcon, LoadBar, ProgressBar, formatHours, unitToken } from './ui.jsx';
import { groupResources } from '../lib/resourceGroups.js';

export default function CourseDetail({ course, focusResources = false, onClose }) {
  const { t, pick } = useLang();
  useProgressVersion();

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = course ? 'hidden' : '';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [course, onClose]);

  useEffect(() => {
    if (!course || !focusResources) return;
    const id = setTimeout(() => {
      document.getElementById('resources-start')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 380);
    return () => clearTimeout(id);
  }, [course, focusResources]);

  const token = unitToken(course?.unit?.type);
  const general = course?.resources?.filter((r) => !r.chapter_id) ?? [];
  const groupedGeneral = groupResources(general);
  const byChapter = (id) => course?.resources?.filter((r) => r.chapter_id === id) ?? [];
  const chapterIds = course?.chapters?.map((c) => c.id) ?? [];
  const doneCount = course ? courseDoneCount(course.code, chapterIds) : 0;

  return (
    <AnimatePresence>
      {course && (
        <motion.div
          className="fixed inset-0 z-50 flex justify-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className="absolute inset-0 bg-ink/25 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />

          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={pick(course, 'title')}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
            className="scroll-slim relative flex h-full w-full max-w-xl flex-col overflow-y-auto bg-canvas shadow-2xl"
          >
            <header className="sticky top-0 z-10 border-b border-hair bg-canvas/95 px-6 py-5 backdrop-blur">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`chip ${token.bg} ${token.text}`}>{course.code}</span>
                    <span className="chip bg-white text-muted">{course.unit?.code}</span>
                    <span className="chip bg-white text-muted">
                      {t('sem.s')} {course.semester}
                    </span>
                  </div>
                  <h2 className="mt-3 font-display text-2xl font-semibold leading-tight tracking-tight">
                    {pick(course, 'title')}
                  </h2>
                </div>
                <button type="button" onClick={onClose} aria-label={t('detail.close')} className="btn-ghost p-2">
                  <X className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>
            </header>

            <div className="space-y-6 px-6 py-6">
              <section className="card p-5">
                <p className="text-[14px] leading-relaxed">{pick(course, 'summary')}</p>

                <div className="rule my-4" />

                <dl className="grid grid-cols-2 gap-4 text-[13px] sm:grid-cols-4">
                  {[
                    [t('card.credits'), course.credits],
                    [t('card.coef'), course.coef],
                    ['VHS', `${course.vhs}h`],
                    [t('card.chapters'), course.chapters.length || '—'],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="font-mono text-[10px] uppercase tracking-[.14em] text-muted">{label}</dt>
                      <dd className="mt-0.5 font-display text-lg font-semibold tabular-nums">{value}</dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-5">
                  <p className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[.14em] text-muted">
                    <span>{t('detail.weekly')}</span>
                    <span className="tabular-nums">{formatHours(course.h_c + course.h_td + course.h_tp)}</span>
                  </p>
                  <LoadBar c={course.h_c} td={course.h_td} tp={course.h_tp} />
                </div>

                {(course.continu > 0 || course.examen > 0) && (
                  <div className="mt-5 flex flex-wrap items-center gap-3 text-[12px] text-muted">
                    <PercentCircle className="h-4 w-4 text-azure" strokeWidth={1.8} aria-hidden="true" />
                    <span>
                      {t('detail.continu')} {Math.round(course.continu * 100)}%
                    </span>
                    {course.examen > 0 && (
                      <span>
                        {t('detail.examen')} {Math.round(course.examen * 100)}%
                      </span>
                    )}
                  </div>
                )}
              </section>

              {(course.prereq_fr || course.teachers) && (
                <section className="grid gap-3 sm:grid-cols-2">
                  {course.teachers && course.teachers !== '—' && (
                    <div className="card p-4">
                      <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[.14em] text-muted">
                        <Users className="h-3.5 w-3.5 text-azure" strokeWidth={1.9} aria-hidden="true" />
                        {t('detail.teachers')}
                      </p>
                      <p className="mt-2 text-[13px] leading-relaxed">{course.teachers}</p>
                    </div>
                  )}
                  {pick(course, 'prereq') && (
                    <div className="card p-4">
                      <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[.14em] text-muted">
                        <GraduationCap className="h-3.5 w-3.5 text-azure" strokeWidth={1.9} aria-hidden="true" />
                        {t('detail.prereq')}
                      </p>
                      <p className="mt-2 text-[13px] leading-relaxed">{pick(course, 'prereq')}</p>
                    </div>
                  )}
                </section>
              )}

              <div id="resources-start">
                {general.length > 0 && (
                  <section>
                    <h3 className="mb-3 font-display text-sm font-semibold uppercase tracking-[.1em] text-muted">
                      {t('detail.resources')}
                    </h3>
                    <div className="space-y-5">
                      {groupedGeneral.map(([key, list]) => (
                        <div key={key}>
                          <h4 className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[.14em] text-azure">
                            {t(`group.${key}`)}
                          </h4>
                          <ul className="space-y-2">
                            {list.map((r) => (
                              <ResourceRow key={r.id} resource={r} />
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                <section className={general.length > 0 ? 'mt-6' : ''}>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="font-display text-sm font-semibold uppercase tracking-[.1em] text-muted">
                      {t('detail.program')}
                    </h3>
                    {chapterIds.length > 0 && (
                      <span className="font-mono text-[11px] tabular-nums text-muted">
                        {doneCount}/{chapterIds.length}
                      </span>
                    )}
                  </div>

                  {chapterIds.length > 0 && (
                    <div className="mb-4">
                      <ProgressBar value={doneCount / chapterIds.length} />
                    </div>
                  )}

                  {course.chapters.length === 0 ? (
                    <p className="card p-4 text-[13px] text-muted">{t('detail.noChapters')}</p>
                  ) : (
                    <ol className="space-y-2">
                      {course.chapters.map((ch) => {
                        const links = byChapter(ch.id);
                        return <ChapterRow key={ch.id} course={course} chapter={ch} links={links} token={token} />;
                      })}
                    </ol>
                  )}
                </section>
              </div>
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ChapterRow({ course, chapter, links, token }) {
  const { t, pick } = useLang();
  const done = isChapterDone(course.code, chapter.id);

  return (
    <li className={`card p-4 transition-colors ${done ? 'border-azure/30 bg-azure-soft/30' : ''}`}>
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg font-mono text-[11px] font-semibold ${
            done ? 'bg-azure text-white' : `${token.bg} ${token.text}`
          }`}
        >
          {String(chapter.position).padStart(2, '0')}
        </span>
        <div className="min-w-0 flex-1">
          <p className={`text-[13.5px] font-medium leading-snug ${done ? 'text-muted line-through' : ''}`}>
            {pick(chapter, 'title')}
          </p>
          {links.length > 0 && (
            <ul className="mt-2.5 space-y-1.5">
              {links.map((r) => (
                <ResourceRow key={r.id} resource={r} dense />
              ))}
            </ul>
          )}
          <ChapterNotes course={course} chapter={chapter} />
        </div>
        <button
          type="button"
          onClick={() => toggleChapter(course.code, chapter.id)}
          aria-pressed={done}
          aria-label={done ? t('detail.markUndone') : t('detail.markDone')}
          title={done ? t('detail.markUndone') : t('detail.markDone')}
          className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg border transition ${
            done ? 'border-azure bg-azure text-white' : 'border-hair text-transparent hover:border-azure hover:text-azure/50'
          }`}
        >
          <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
        </button>
      </div>
    </li>
  );
}

function ChapterNotes({ course, chapter }) {
  const { t } = useLang();
  const [value, setValue] = useState(() => getNote(course.code, chapter.id));
  const [open, setOpen] = useState(() => Boolean(getNote(course.code, chapter.id)));

  const onChange = (e) => {
    setValue(e.target.value);
    setNote(course.code, chapter.id, e.target.value);
  };

  return (
    <div className="mt-2.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[.12em] text-muted transition hover:text-azure"
      >
        <PenLine className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
        {t('detail.notes')}
        {value && !open && <span className="h-1.5 w-1.5 rounded-full bg-azure" aria-hidden="true" />}
      </button>
      {open && (
        <textarea
          value={value}
          onChange={onChange}
          placeholder={t('detail.notesPlaceholder')}
          rows={3}
          className="field mt-1.5 text-[12.5px] leading-relaxed"
        />
      )}
    </div>
  );
}

function ResourceRow({ resource, dense = false }) {
  const { t } = useLang();
  return (
    <li>
      <a
        href={resource.url}
        target="_blank"
        rel="noreferrer"
        className={`group flex items-center gap-3 rounded-xl border border-hair bg-white px-3 transition hover:border-azure hover:bg-azure-soft/60 ${
          dense ? 'py-2' : 'py-2.5'
        }`}
      >
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-azure-soft text-azure">
          <KindIcon kind={resource.kind} className="h-3.5 w-3.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium">{resource.label}</span>
          <span className="block font-mono text-[10px] uppercase tracking-[.12em] text-muted">
            {t(`kind.${resource.kind}`) ?? resource.kind}
          </span>
        </span>
        <ArrowUpRight
          className="h-4 w-4 shrink-0 text-muted transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-azure"
          strokeWidth={2}
          aria-hidden="true"
        />
      </a>
    </li>
  );
}
