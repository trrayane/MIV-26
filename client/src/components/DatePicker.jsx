import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLang } from '../lib/i18n.jsx';

const WEEKDAYS_FR = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const WEEKDAYS_EN = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function toISO(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Compact calendar popover — replaces a bare <input type="date"> with something that matches the design system. */
export default function DatePicker({ value, onChange, placeholder = 'jj/mm/aaaa' }) {
  const { lang } = useLang();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = value ? new Date(`${value}T00:00:00`) : null;
  const [viewDate, setViewDate] = useState(selected || new Date());

  useEffect(() => {
    const onDocClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = viewDate.toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { month: 'long', year: 'numeric' });
  const weekdays = lang === 'en' ? WEEKDAYS_EN : WEEKDAYS_FR;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const pick = (d) => {
    onChange(toISO(year, month, d));
    setOpen(false);
  };

  const fmt = (iso) => {
    const d = new Date(`${iso}T00:00:00`);
    return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="field flex w-full items-center gap-2 text-left text-sm"
      >
        <CalendarDays className="h-4 w-4 shrink-0 text-muted" strokeWidth={1.8} />
        <span className={`flex-1 truncate ${value ? '' : 'text-muted'}`}>{value ? fmt(value) : placeholder}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="card absolute z-50 mt-1.5 w-64 p-3 shadow-lift"
          >
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setViewDate(new Date(year, month - 1, 1))}
                className="rounded-lg p-1.5 text-muted transition hover:bg-canvas hover:text-azure"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={2} />
              </button>
              <p className="font-display text-sm font-semibold capitalize">{monthLabel}</p>
              <button
                type="button"
                onClick={() => setViewDate(new Date(year, month + 1, 1))}
                className="rounded-lg p-1.5 text-muted transition hover:bg-canvas hover:text-azure"
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>

            <div className="mt-2 grid grid-cols-7 gap-1 text-center">
              {weekdays.map((w, i) => (
                <span key={i} className="font-mono text-[10px] uppercase text-muted">{w}</span>
              ))}
              {cells.map((d, i) => {
                if (!d) return <span key={i} />;
                const iso = toISO(year, month, d);
                const isSelected = value === iso;
                const cellDate = new Date(year, month, d);
                const isToday = cellDate.getTime() === today.getTime();
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => pick(d)}
                    className={`rounded-lg py-1.5 text-sm transition ${
                      isSelected
                        ? 'bg-azure font-semibold text-white'
                        : isToday
                        ? 'bg-azure-soft text-azure'
                        : 'hover:bg-canvas'
                    }`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
