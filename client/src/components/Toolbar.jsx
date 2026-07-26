import { motion } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { useLang } from '../lib/i18n.jsx';

export default function Toolbar({ semesters, active, onSelect, query, onQuery }) {
  const { t } = useLang();

  const tabs = [{ number: 0, label: t('sem.all') }, ...semesters.map((s) => ({ number: s.number, label: `S${s.number}` }))];

  return (
    <div className="mx-auto mt-10 flex max-w-6xl flex-col gap-3 px-5 sm:flex-row sm:items-center sm:justify-between">
      <div role="tablist" aria-label={t('stats.semester')} className="flex flex-wrap items-center gap-1 rounded-2xl border border-hair bg-white/70 p-1 backdrop-blur">
        {tabs.map((tab) => {
          const selected = active === tab.number;
          return (
            <button
              key={tab.number}
              role="tab"
              aria-selected={selected}
              onClick={() => onSelect(tab.number)}
              className={`relative rounded-xl px-3.5 py-2 font-mono text-[11px] font-semibold uppercase tracking-[.12em] transition-colors ${
                selected ? 'text-white' : 'text-muted hover:text-ink'
              }`}
            >
              {selected && (
                <motion.span
                  layoutId="sem-pill"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  className="absolute inset-0 -z-10 rounded-xl bg-azure"
                />
              )}
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="relative w-full sm:max-w-sm md:max-w-md">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" strokeWidth={1.9} aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={t('search.placeholder')}
          aria-label={t('search.placeholder')}
          className="field pl-10 pr-9"
        />
        {query && (
          <button
            type="button"
            onClick={() => onQuery('')}
            aria-label={t('search.reset')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-muted hover:text-ink"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        )}
      </div>
    </div>
  );
}
