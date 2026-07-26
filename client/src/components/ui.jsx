import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Boxes,
  Check,
  ChevronDown,
  Download,
  ExternalLink,
  FileText,
  FlaskConical,
  FolderOpen,
  GraduationCap,
  Globe,
  Library,
  Moon,
  PlayCircle,
  Sun,
  Wrench,
  X,
} from 'lucide-react';
import { fileUrl } from '../lib/api.js';
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
      className="relative flex items-center rounded-full border border-hair bg-surface/80 p-1 backdrop-blur"
    >
      {['fr', 'en'].map((code) => {
        const active = lang === code;
        return (
          <button
            key={code}
            type="button"
            onClick={() => setLang(code)}
            aria-pressed={active}
            className={`relative z-10 rounded-full px-3 py-1 font-mono text-xs font-semibold uppercase tracking-[.14em] transition-colors ${
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

function getInitialTheme() {
  if (typeof window === 'undefined') return 'light';
  const stored = localStorage.getItem('miv.theme');
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeToggle() {
  const { t } = useLang();
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('miv.theme', theme);
  }, [theme]);

  const dark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      aria-pressed={dark}
      aria-label={t('theme.aria')}
      title={t('theme.aria')}
      className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full border border-hair bg-surface/80 text-muted backdrop-blur transition hover:text-azure"
    >
      {dark ? <Sun className="h-4 w-4" strokeWidth={1.8} /> : <Moon className="h-4 w-4" strokeWidth={1.8} />}
    </button>
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
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs text-muted">
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
        {label && (
          <span className="mt-0.5 block whitespace-nowrap font-mono text-[0.6rem] uppercase tracking-[.06em] text-muted">
            {label}
          </span>
        )}
      </span>
    </div>
  );
}

export function ProgressBar({ value = 0, label, compact = false }) {
  const pct = Math.round(Math.min(Math.max(value, 0), 1) * 100);
  return (
    <div className="w-full">
      {label && (
        <div className="mb-1.5 flex items-center justify-between font-mono text-xs uppercase tracking-[.14em] text-muted">
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
  return <div className={`animate-pulse rounded-xl bg-surface/70 ${className}`} />;
}

/** Only our own hosted PDFs can be embedded — external (Drive) links block iframing. */
export function isPreviewablePdf(url) {
  if (!url) return false;
  return url.startsWith('/files/') && /\.pdf(\?|$)/i.test(url);
}

/** Full-screen in-app PDF reader so students can read without downloading. */
export function PdfViewer({ resource, onClose }) {
  const { t } = useLang();

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const src = resource ? fileUrl(resource.url) : null;

  return (
    <AnimatePresence>
      {resource && (
        <motion.div
          className="fixed inset-0 z-[70] flex flex-col bg-ink/70 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <div className="flex items-center gap-3 border-b border-white/10 bg-ink px-4 py-2.5 text-white">
            <FileText className="h-4 w-4 shrink-0 text-white/70" strokeWidth={1.8} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{resource.label}</span>
            <a
              href={src}
              target="_blank"
              rel="noreferrer"
              title={t('preview.newTab')}
              aria-label={t('preview.newTab')}
              className="rounded-lg p-2 text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              <ExternalLink className="h-4 w-4" strokeWidth={1.9} />
            </a>
            <a
              href={src}
              download
              title={t('preview.download')}
              aria-label={t('preview.download')}
              className="rounded-lg p-2 text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              <Download className="h-4 w-4" strokeWidth={1.9} />
            </a>
            <button
              type="button"
              onClick={onClose}
              title={t('preview.close')}
              aria-label={t('preview.close')}
              className="rounded-lg p-2 text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
          <iframe src={src} title={resource.label} className="min-h-0 flex-1 bg-white" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 flex-none items-center rounded-full transition-colors duration-200 ${
        checked ? 'bg-azure' : 'bg-hair'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? 'translate-x-[22px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

export function Select({ id, value, onChange, options, placeholder }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const current = options.find((o) => String(o.value) === String(value));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        id={id}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="field flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="truncate">{current ? current.label : placeholder ?? ''}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
          strokeWidth={2}
          aria-hidden="true"
        />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1.5 max-h-56 w-full overflow-auto rounded-xl border border-hair bg-surface p-1 shadow-lift"
        >
          {options.map((o) => {
            const selected = String(o.value) === String(value);
            return (
              <li key={o.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                    selected ? 'bg-azure text-white' : 'hover:bg-azure-soft'
                  }`}
                >
                  <span className="truncate">{o.label}</span>
                  {selected && <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.4} aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
