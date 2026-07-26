import { motion } from 'framer-motion';
import {
  BookOpen,
  Boxes,
  FileText,
  FlaskConical,
  FolderOpen,
  GraduationCap,
  Globe,
  Library,
  PlayCircle,
  Wrench,
} from 'lucide-react';
import { useLang } from '../lib/i18n.jsx';

/* Teaching-unit families carry the colour code across the whole interface. */
export const UNIT_TOKENS = {
  F: { text: 'text-azure', bg: 'bg-azure-soft', ring: 'ring-azure/25', bar: 'bg-azure', hex: '#1B5CE5' },
  M: { text: 'text-aqua', bg: 'bg-aqua-soft', ring: 'ring-aqua/25', bar: 'bg-aqua', hex: '#0EA5C6' },
  D: { text: 'text-iris', bg: 'bg-iris-soft', ring: 'ring-iris/25', bar: 'bg-iris', hex: '#6D5BF5' },
  P: { text: 'text-azure-deep', bg: 'bg-azure-soft', ring: 'ring-azure/25', bar: 'bg-azure-deep', hex: '#0B2F86' },
};
export const unitToken = (type) => UNIT_TOKENS[type] ?? UNIT_TOKENS.F;

export const KIND_ICON = {
  drive: FolderOpen,
  pdf: FileText,
  video: PlayCircle,
  course: GraduationCap,
  tool: Wrench,
  reference: Library,
  lab: FlaskConical,
  platform: Globe,
};

export function KindIcon({ kind, className = 'h-4 w-4' }) {
  const Icon = KIND_ICON[kind] ?? BookOpen;
  return <Icon className={className} strokeWidth={1.75} aria-hidden="true" />;
}

/* --------------------------------------------------------------- branding */

export function Logo({ className = 'h-10 w-10' }) {
  return (
    <span className={`relative grid place-items-center rounded-xl bg-azure ${className}`}>
      <span className="absolute inset-0 overflow-hidden rounded-xl">
        <span className="absolute inset-y-0 -left-1/3 w-1/3 skew-x-12 bg-white/25 animate-sweep" />
      </span>
      <Boxes className="relative h-1/2 w-1/2 text-white" strokeWidth={1.9} aria-hidden="true" />
    </span>
  );
}

export function LangToggle() {
  const { lang, setLang, t } = useLang();
  return (
    <div
      role="group"
      aria-label={t('lang.aria')}
      className="relative flex items-center rounded-full border border-hair bg-white/80 p-1 backdrop-blur"
    >
      {['fr', 'en'].map((code) => {
        const active = lang === code;
        return (
          <button
            key={code}
            type="button"
            onClick={() => setLang(code)}
            aria-pressed={active}
            className={`relative z-10 rounded-full px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[.14em] transition-colors ${
              active ? 'text-white' : 'text-muted hover:text-ink'
            }`}
          >
            {active && (
              <motion.span
                layoutId="lang-pill"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                className="absolute inset-0 -z-10 rounded-full bg-azure"
              />
            )}
            {code}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------ data pieces */

/**
 * Weekly hours split into lecture / tutorial / lab.
 * The proportions are real: they come from the V.H hebdomadaire column.
 */
export function LoadBar({ c = 0, td = 0, tp = 0, compact = false }) {
  const total = c + td + tp;
  if (!total) return null;
  const seg = [
    { key: 'C', value: c, className: 'bg-azure' },
    { key: 'TD', value: td, className: 'bg-aqua' },
    { key: 'TP', value: tp, className: 'bg-iris' },
  ].filter((s) => s.value > 0);

  return (
    <div className="w-full">
      <div className="flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full bg-hair/70">
        {seg.map((s) => (
          <motion.span
            key={s.key}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            style={{ width: `${(s.value / total) * 100}%`, transformOrigin: 'left' }}
            className={`${s.className} rounded-full`}
          />
        ))}
      </div>
      {!compact && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] text-muted">
          {seg.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${s.className}`} />
              {s.key} {formatHours(s.value)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function formatHours(h) {
  if (!h) return '—';
  const hours = Math.floor(h);
  const minutes = Math.round((h - hours) * 60);
  return minutes ? `${hours}h${String(minutes).padStart(2, '0')}` : `${hours}h`;
}

export function CreditRing({ value, max = 30, size = 78, stroke = 7, color = '#1B5CE5', label, suffix = '' }) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = Math.min(value / max, 1);

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#DCE7F8" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - pct) }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <span className="absolute text-center leading-none">
        <span className="block font-display text-lg font-semibold">
          {value}
          {suffix}
        </span>
        {label && <span className="mt-0.5 block font-mono text-[9px] uppercase tracking-[.14em] text-muted">{label}</span>}
      </span>
    </div>
  );
}

export function ProgressBar({ value = 0, label, compact = false }) {
  const pct = Math.round(Math.min(Math.max(value, 0), 1) * 100);
  return (
    <div className="w-full">
      {label && (
        <div className="mb-1.5 flex items-center justify-between font-mono text-[10px] uppercase tracking-[.14em] text-muted">
          <span>{label}</span>
          <span className="tabular-nums">{pct}%</span>
        </div>
      )}
      <div className={`w-full overflow-hidden rounded-full bg-canvas ${compact ? 'h-1' : 'h-1.5'}`}>
        <motion.div
          initial={false}
          animate={{ scaleX: pct / 100 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformOrigin: 'left' }}
          className="h-full rounded-full bg-azure"
        />
      </div>
    </div>
  );
}

export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-xl bg-white/70 ${className}`} />;
}
