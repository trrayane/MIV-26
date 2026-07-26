import { motion } from 'framer-motion';
import { Clock3, Layers, LibraryBig, Link2, Sparkles, Star } from 'lucide-react';
import { useLang } from '../lib/i18n.jsx';
import { CreditRing } from './ui.jsx';

const ITEMS = [
  { key: 'credits', icon: Star, labelKey: 'stats.credits' },
  { key: 'hours', icon: Clock3, labelKey: 'stats.hours', suffix: 'h' },
  { key: 'courses', icon: LibraryBig, labelKey: 'stats.courses' },
  { key: 'units', icon: Layers, labelKey: 'stats.units' },
  { key: 'chapters', icon: Sparkles, labelKey: 'stats.chapters' },
  { key: 'resources', icon: Link2, labelKey: 'stats.resources' },
];

export default function StatBar({ totals, scopeLabel, ringValue, ringMax }) {
  const { t } = useLang();

  return (
    <section className="mx-auto mt-8 max-w-6xl px-5">
      <div className="card flex flex-col items-center gap-5 p-5 sm:flex-row sm:justify-center">
        <div className="flex items-center gap-4 sm:pr-5">
          <CreditRing value={ringValue} max={ringMax} label={t('stats.credits')} />
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[.18em] text-muted">{t('stats.semester')}</p>
            <p className="truncate font-display text-lg font-semibold">{scopeLabel}</p>
          </div>
        </div>

        <div className="hidden w-px self-stretch bg-hair sm:block" />

        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
          {ITEMS.map(({ key, icon: Icon, labelKey, suffix }, i) => (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.04 * i }}
              className="min-w-0"
            >
              <dt className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[.14em] text-muted">
                <Icon className="h-3.5 w-3.5 text-azure" strokeWidth={1.9} aria-hidden="true" />
                {t(labelKey)}
              </dt>
              <dd className="mt-1 font-display text-xl font-semibold tabular-nums">
                {(totals?.[key] ?? 0).toLocaleString('fr-FR')}
                {suffix && <span className="ml-0.5 text-sm font-medium text-muted">{suffix}</span>}
              </dd>
            </motion.div>
          ))}
        </dl>
      </div>
    </section>
  );
}
