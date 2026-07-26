import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpRight, Check, Download, Eye, GraduationCap, PenLine, PercentCircle, Send, Sparkles, Users, X } from 'lucide-react';
import { useLang } from '../lib/i18n.jsx';
import { api, fileUrl } from '../lib/api.js';
import { getNote, setNote } from '../lib/notes.js';
import { courseDoneCount, isChapterDone, toggleChapter, useProgressVersion } from '../lib/progress.js';
import { KindIcon, LoadBar, PdfViewer, ProgressBar, isPreviewablePdf, formatHours, unitToken } from './ui.jsx';
import { groupResources } from '../lib/resourceGroups.js';

/** True if the resource was added within the last 7 days. */
function isRecent(createdAt) {
  if (!createdAt) return false;
  const t = Date.parse(createdAt.replace(' ', 'T'));
  if (Number.isNaN(t)) return false;
  return Date.now() - t < 7 * 24 * 60 * 60 * 1000;
}

export default function CourseDetail({ course, focusResources = false, onClose }) {
  const { t, pick } = useLang();
  useProgressVersion();
  const [preview, setPreview] = useState(null);

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
            <header className="sticky top-0 z-10 border-b border-hair bg-canvas/95 px-5 py-4 backdrop-blur sm:px-6 sm:py-5">
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

            <div className="space-y-6 px-4 py-5 sm:px-6 sm:py-6">
              <section className="card p-5">
                <p className="text-sm leading-relaxed">{pick(course, 'summary')}</p>

                <div className="rule my-4" />

                <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                  {[
                    [t('card.credits'), course.credits],
                    [t('card.coef'), course.coef],
                    ['VHS', `${course.vhs}h`],
                    [t('card.chapters'), course.chapters.length || '—'],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="font-mono text-xs uppercase tracking-[.14em] text-muted">{label}</dt>
                      <dd className="mt-0.5 font-display text-lg font-semibold tabular-nums">{value}</dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-5">
                  <p className="mb-2 flex items-center justify-between font-mono text-xs uppercase tracking-[.14em] text-muted">
                    <span>{t('detail.weekly')}</span>
                    <span className="tabular-nums">{formatHours(course.h_c + course.h_td + course.h_tp)}</span>
                  </p>
                  <LoadBar c={course.h_c} td={course.h_td} tp={course.h_tp} />
                </div>

                {(course.continu > 0 || course.examen > 0) && (
                  <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-muted">
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
                      <p className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-[.14em] text-muted">
                        <Users className="h-3.5 w-3.5 text-azure" strokeWidth={1.9} aria-hidden="true" />
                        {t('detail.teachers')}
                      </p>
                      <p className="mt-2 text-sm leading-relaxed">{course.teachers}</p>
                    </div>
                  )}
                  {pick(course, 'prereq') && (
                    <div className="card p-4">
                      <p className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-[.14em] text-muted">
                        <GraduationCap className="h-3.5 w-3.5 text-azure" strokeWidth={1.9} aria-hidden="true" />
                        {t('detail.prereq')}
                      </p>
                      <p className="mt-2 text-sm leading-relaxed">{pick(course, 'prereq')}</p>
                    </div>
                  )}
                </section>
              )}

              <AssistantPanel course={course} />

              <div id="resources-start">
                {course.resources?.some((r) => r.url?.startsWith('/files/')) && (
                  <a
                    href={api.moduleDownloadUrl(course.code)}
                    className="btn-ghost mb-5 w-full text-sm"
                  >
                    <Download className="h-4 w-4" strokeWidth={1.9} />
                    {t('detail.downloadAll')}
                  </a>
                )}
                {general.length > 0 && (
                  <section>
                    <h3 className="mb-3 font-display text-sm font-semibold uppercase tracking-[.1em] text-muted">
                      {t('detail.resources')}
                    </h3>
                    <div className="space-y-5">
                      {groupedGeneral.map(([key, list]) => (
                        <div key={key}>
                          <h4 className="mb-2 font-mono text-xs font-semibold uppercase tracking-[.14em] text-azure">
                            {t(`group.${key}`)}
                          </h4>
                          <ul className="space-y-2">
                            {list.map((r) => (
                              <ResourceRow key={r.id} resource={r} onPreview={setPreview} />
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
                      <span className="font-mono text-xs tabular-nums text-muted">
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
                    <p className="card p-4 text-sm text-muted">{t('detail.noChapters')}</p>
                  ) : (
                    <ol className="space-y-2">
                      {course.chapters.map((ch) => {
                        const links = byChapter(ch.id);
                        return <ChapterRow key={ch.id} course={course} chapter={ch} links={links} token={token} onPreview={setPreview} />;
                      })}
                    </ol>
                  )}
                </section>
              </div>
            </div>
          </motion.aside>

          <PdfViewer resource={preview} onClose={() => setPreview(null)} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function AssistantPanel({ course }) {
  const { t, lang } = useLang();
  const [enabled, setEnabled] = useState(null);
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.assistantStatus().then((s) => setEnabled(s.enabled)).catch(() => setEnabled(false));
  }, []);

  useEffect(() => {
    setMessages([]);
    setQuestion('');
    setError(null);
  }, [course?.code]);

  if (!enabled) return null;

  const ask = async (e) => {
    e.preventDefault();
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true);
    setError(null);
    setMessages((m) => [...m, { role: 'user', text: q }]);
    setQuestion('');
    try {
      const { answer } = await api.askAssistant(course.code, q, lang);
      setMessages((m) => [...m, { role: 'assistant', text: answer }]);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card p-5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 text-left"
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-azure-soft text-azure">
          <Sparkles className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
        </span>
        <span className="flex-1">
          <span className="block font-display text-sm font-semibold uppercase tracking-[.1em] text-muted">
            {t('assistant.title')}
          </span>
          <span className="block text-xs text-muted">{t('assistant.hint')}</span>
        </span>
      </button>

      {open && (
        <div className="mt-4">
          {messages.length > 0 && (
            <div className="scroll-slim mb-3 max-h-[420px] min-h-[160px] space-y-3 overflow-y-auto">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`rounded-xl px-3 py-2 text-sm leading-relaxed ${
                    m.role === 'user' ? 'ml-6 bg-azure-soft text-ink' : 'mr-6 bg-canvas text-ink'
                  }`}
                >
                  {m.text}
                </div>
              ))}
              {busy && <div className="mr-6 rounded-xl bg-canvas px-3 py-2 text-sm text-muted">{t('assistant.thinking')}</div>}
            </div>
          )}
          <form onSubmit={ask} className="flex items-center gap-2">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={t('assistant.placeholder')}
              className="field flex-1 text-sm"
            />
            <button type="submit" disabled={busy || !question.trim()} className="btn-primary px-3">
              <Send className="h-4 w-4" strokeWidth={2} />
            </button>
          </form>
          {error && <p className="mt-2 text-xs text-azure-deep">{error}</p>}
        </div>
      )}
    </section>
  );
}

function ChapterRow({ course, chapter, links, token, onPreview }) {
  const { t, pick } = useLang();
  const done = isChapterDone(course.code, chapter.id);

  return (
    <li className={`card p-4 transition-colors ${done ? 'border-azure/30 bg-azure-soft/30' : ''}`}>
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg font-mono text-xs font-semibold ${
            done ? 'bg-azure text-white' : `${token.bg} ${token.text}`
          }`}
        >
          {String(chapter.position).padStart(2, '0')}
        </span>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-medium leading-snug ${done ? 'text-muted line-through' : ''}`}>
            {pick(chapter, 'title')}
          </p>
          {links.length > 0 && (
            <ul className="mt-2.5 space-y-1.5">
              {links.map((r) => (
                <ResourceRow key={r.id} resource={r} dense onPreview={onPreview} />
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
        className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-[.12em] text-muted transition hover:text-azure"
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
          className="field mt-1.5 text-xs leading-relaxed"
        />
      )}
    </div>
  );
}

function ResourceRow({ resource, dense = false, onPreview }) {
  const { t } = useLang();
  const previewable = isPreviewablePdf(resource.url) && typeof onPreview === 'function';
  const recent = isRecent(resource.created_at);

  const inner = (
    <>
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-azure-soft text-azure">
        <KindIcon kind={resource.kind} className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="min-w-0 truncate text-sm font-medium">{resource.label}</span>
          {recent && (
            <span className="shrink-0 rounded-full bg-signal/15 px-2 py-0.5 font-mono text-xs font-medium text-signal">
              {t('resource.new')}
            </span>
          )}
        </span>
        <span className="block font-mono text-xs uppercase tracking-[.12em] text-muted">
          {t(`kind.${resource.kind}`) ?? resource.kind}
        </span>
      </span>
      {previewable ? (
        <Eye className="h-4 w-4 shrink-0 text-muted transition group-hover:text-azure" strokeWidth={2} aria-hidden="true" />
      ) : (
        <ArrowUpRight
          className="h-4 w-4 shrink-0 text-muted transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-azure"
          strokeWidth={2}
          aria-hidden="true"
        />
      )}
    </>
  );

  const cls = `group flex w-full items-center gap-3 rounded-xl border border-hair bg-white px-3 text-left transition hover:border-azure hover:bg-azure-soft/60 ${
    dense ? 'py-2' : 'py-2.5'
  }`;

  return (
    <li>
      {previewable ? (
        <button type="button" onClick={() => onPreview(resource)} className={cls}>
          {inner}
        </button>
      ) : (
        <a href={fileUrl(resource.url)} target="_blank" rel="noreferrer" className={cls}>
          {inner}
        </a>
      )}
    </li>
  );
}
