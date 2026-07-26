import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, ArrowUpRight, RotateCw } from 'lucide-react';
import { api } from '../lib/api.js';
import { useLang } from '../lib/i18n.jsx';
import { Hero } from '../components/Header.jsx';
import StatBar from '../components/StatBar.jsx';
import Dashboard from '../components/Dashboard.jsx';
import Toolbar from '../components/Toolbar.jsx';
import CourseCard from '../components/CourseCard.jsx';
import CourseDetail from '../components/CourseDetail.jsx';
import { KindIcon, Skeleton, unitToken } from '../components/ui.jsx';
import { isBookmarked, useBookmarksVersion } from '../lib/bookmarks.js';
import { setLastViewed } from '../lib/recent.js';

export default function Hub({ program }) {
  const { t, pick, lang } = useLang();
  const [curriculum, setCurriculum] = useState(null);
  const [error, setError] = useState(null);
  const [semester, setSemester] = useState(1);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [focusResources, setFocusResources] = useState(false);
  const bookmarksVersion = useBookmarksVersion();

  const openCourse = (course, focus = false) => {
    setSelected(course);
    setFocusResources(focus);
    setLastViewed(course.code);
  };

  const load = () => {
    setError(null);
    setCurriculum(null);
    api
      .curriculum()
      .then(setCurriculum)
      .catch((e) => setError(e.message));
  };

  useEffect(load, []);

  const scoped = useMemo(() => {
    if (!curriculum) return [];
    return semester === 0 ? curriculum : curriculum.filter((s) => s.number === semester);
  }, [curriculum, semester]);

  const needle = query.trim().toLowerCase();
  const matches = (course) => {
    if (!needle) return true;
    const haystack = [
      course.code,
      course.title_fr,
      course.title_en,
      course.summary_fr,
      course.summary_en,
      course.teachers,
      ...course.chapters.flatMap((c) => [c.title_fr, c.title_en]),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(needle);
  };

  const groups = useMemo(
    () =>
      scoped.flatMap((sem) =>
        sem.units
          .map((unit) => ({
            sem,
            unit,
            courses: unit.courses
              .filter(matches)
              .slice()
              .sort((a, b) => (isBookmarked(b.code) ? 1 : 0) - (isBookmarked(a.code) ? 1 : 0)),
          }))
          .filter((g) => g.courses.length > 0)
      ),
    [scoped, needle, bookmarksVersion]
  );

  const totals = useMemo(() => {
    const courses = scoped.flatMap((s) => s.units.flatMap((u) => u.courses));
    return {
      credits: courses.reduce((n, c) => n + c.credits, 0),
      hours: courses.reduce((n, c) => n + c.vhs, 0),
      courses: courses.length,
      units: scoped.reduce((n, s) => n + s.units.length, 0),
      chapters: courses.reduce((n, c) => n + c.chapters.length, 0),
      resources: courses.reduce((n, c) => n + c.resources.length, 0),
    };
  }, [scoped]);

  const scopeLabel = semester === 0 ? t('stats.whole') : `${t('sem.s')} ${semester}`;
  const visibleCount = groups.reduce((n, g) => n + g.courses.length, 0);

  return (
    <>
      <Hero program={program} />

      {curriculum && <Dashboard curriculum={curriculum} onContinue={(course) => openCourse(course, true)} />}

      {curriculum && scoped.some((sem) => sem.driveLinks?.length > 0) && (
        <div className="mx-auto mt-8 max-w-6xl px-5">
          <DriveSpace curriculum={scoped} />
        </div>
      )}

      <StatBar
        totals={totals}
        scopeLabel={scopeLabel}
        ringValue={totals.credits}
        ringMax={semester === 0 ? 120 : 30}
      />

      {curriculum && (
        <Toolbar
          semesters={curriculum}
          active={semester}
          onSelect={setSemester}
          query={query}
          onQuery={setQuery}
        />
      )}

      <main className="mx-auto max-w-6xl px-5 pb-4">
        {error && (
          <div className="card mt-10 flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center">
            <AlertTriangle className="h-5 w-5 shrink-0 text-azure" strokeWidth={1.9} aria-hidden="true" />
            <p className="flex-1 text-sm">{t('error.load')}</p>
            <button type="button" onClick={load} className="btn-ghost text-[13px]">
              <RotateCw className="h-4 w-4" strokeWidth={1.9} />
              {t('error.retry')}
            </button>
          </div>
        )}

        {!curriculum && !error && (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-72" />
            ))}
          </div>
        )}

        {curriculum && visibleCount === 0 && (
          <div className="card mt-10 p-8 text-center">
            <p className="text-sm text-muted">{t('search.empty')}</p>
            <button type="button" onClick={() => setQuery('')} className="btn-ghost mt-4 text-[13px]">
              {t('search.reset')}
            </button>
          </div>
        )}

        {groups.map(({ sem, unit, courses }) => {
          const token = unitToken(unit.type);
          return (
            <section key={`${sem.number}-${unit.code}`} className="mt-10 scroll-mt-28" id={`${unit.code}`}>
              <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="font-display text-lg font-semibold tracking-tight">
                  <span className={`${token.text}`}>{unit.code}</span>{' '}
                  <span className="text-muted">· {t(`unit.${unit.type}`)}</span>
                </h2>
                <span className="font-mono text-[11px] uppercase tracking-[.14em] text-muted">
                  {semester === 0 ? `S${sem.number} · ` : ''}
                  {unit.credits} {t('card.credits')} · {unit.vhs}h · {t('card.coef')} {unit.coef}
                </span>
              </div>

              <motion.div layout className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {courses.map((course, i) => (
                  <CourseCard key={course.id} course={course} index={i} onOpen={openCourse} />
                ))}
              </motion.div>
            </section>
          );
        })}
      </main>

      <CourseDetail
        key={lang}
        course={selected}
        focusResources={focusResources}
        onClose={() => setSelected(null)}
      />
    </>
  );
}

function DriveSpace({ curriculum }) {
  const { t } = useLang();
  const withLinks = curriculum.filter((sem) => sem.driveLinks?.length > 0);

  return (
    <section className="card p-5">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-azure-soft text-azure">
          <KindIcon kind="drive" className="h-4 w-4" />
        </span>
        <h2 className="font-display text-base font-semibold tracking-tight">{t('group.drive')}</h2>
      </div>

      <div className="mt-4 space-y-5">
        {withLinks.map((sem) => (
          <div key={sem.number}>
            {withLinks.length > 1 && (
              <p className="mb-2 font-mono text-[10.5px] uppercase tracking-[.14em] text-muted">
                {t('sem.s')} {sem.number}
              </p>
            )}
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {sem.driveLinks.map((l) => (
                <li key={l.id}>
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-center gap-3 rounded-xl border border-hair bg-white px-3 py-2.5 transition hover:border-azure hover:bg-azure-soft/60"
                  >
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-azure-soft text-azure">
                      <KindIcon kind="drive" className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{l.label}</span>
                    <ArrowUpRight
                      className="h-4 w-4 shrink-0 text-muted transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-azure"
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
