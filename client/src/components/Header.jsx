import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowUpRight, FileText, ScrollText } from 'lucide-react';
import { useLang } from '../lib/i18n.jsx';
import { LangToggle, Logo, ThemeToggle } from './ui.jsx';
import AccountButton from './AccountButton.jsx';

export function TopBar({ program }) {
  const { t } = useLang();
  const { pathname } = useLocation();
  const onAdmin = pathname.startsWith('/admin');

  return (
    <header className="sticky top-0 z-40 border-b border-hair/80 bg-canvas/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3 sm:gap-5 sm:px-5">
        <Link to="/" className="flex min-w-0 items-center gap-2.5">
          <Logo className="h-9 w-9 shrink-0 sm:h-10 sm:w-10" />
          <span className="min-w-0 leading-tight">
            <span className="block truncate font-display text-sm font-semibold tracking-tight">
              MIV<span className="text-azure"> · </span>USTHB
            </span>
            <span className="hidden truncate font-mono text-xs uppercase tracking-[.18em] text-muted sm:block">
              {t('hero.title')}
            </span>
          </span>
        </Link>

        <nav className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          {onAdmin && (
            <Link to="/" className="btn-ghost hidden px-3 py-2 text-sm sm:inline-flex">
              <ScrollText className="h-4 w-4" strokeWidth={1.75} />
              {t('admin.backToHub')}
            </Link>
          )}
          <ThemeToggle />
          <LangToggle />
          <AccountButton />
        </nav>
      </div>
    </header>
  );
}

export function Hero({ program }) {
  const { t } = useLang();
  const links = program?.links ?? {};

  return (
    <section className="mx-auto max-w-6xl px-5 pb-2 pt-8 sm:pt-14">
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="font-mono text-xs uppercase tracking-[.12em] text-azure sm:tracking-[.2em]"
      >
        {t('hero.eyebrow')}
      </motion.p>

      <div className="mt-3 grid gap-8 lg:grid-cols-[1.15fr_.85fr] lg:items-end">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
            className="font-display text-[2.1rem] font-semibold leading-[1.05] tracking-tight sm:text-6xl sm:leading-[1.02]"
          >
            {t('hero.title')}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="mt-4 max-w-xl text-base leading-relaxed text-muted"
          >
            {t('hero.lead')}
          </motion.p>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <a href={links.ficheTechnique} target="_blank" rel="noreferrer" className="btn-primary text-sm">
              <FileText className="h-4 w-4" strokeWidth={1.75} />
              {t('hero.fiche')}
            </a>
            <a href={links.cahierDesCharges} target="_blank" rel="noreferrer" className="btn-ghost text-sm">
              <ScrollText className="h-4 w-4" strokeWidth={1.75} />
              {t('hero.cahier')}
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />
            </a>
          </div>
        </div>

        <motion.aside
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="card p-5"
        >
          <p className="font-mono text-xs uppercase tracking-[.18em] text-muted">{t('hero.tracks')}</p>
          <ol className="mt-3 space-y-3">
            {[t('hero.track1'), t('hero.track2'), t('hero.track3')].map((track, i) => (
              <li key={track} className="flex gap-3 text-sm">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md bg-azure-soft font-mono text-xs font-semibold text-azure">
                  {i + 1}
                </span>
                <span className="leading-snug">{track}</span>
              </li>
            ))}
          </ol>
          <div className="rule my-4" />
          <p className="text-xs leading-relaxed text-muted">
            {t('hero.university')}
            <br />
            <span className="text-muted/80">{t('hero.faculty')}</span>
          </p>
        </motion.aside>
      </div>
    </section>
  );
}
