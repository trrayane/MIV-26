import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';
import { useLang } from '../lib/i18n.jsx';
import { unitToken } from './ui.jsx';

/** Custom module dropdown — code chip (colored by unit type) + title, used anywhere a plain
 * <select> of courses would otherwise look like a bare native control. */
export default function ModulePicker({ courses, code, onChange, placeholder = '—' }) {
  const { pick } = useLang();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = courses.find((c) => c.code === code);

  useEffect(() => {
    const onDocClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="field flex w-full items-center gap-2 text-left text-sm"
      >
        {current ? (
          <>
            <span className={`chip ${unitToken(current.unit?.type).bg} ${unitToken(current.unit?.type).text}`}>
              {current.code}
            </span>
            <span className="min-w-0 flex-1 truncate">{pick(current, 'title')}</span>
          </>
        ) : (
          <span className="flex-1 text-muted">{placeholder}</span>
        )}
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`} strokeWidth={2} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="scroll-slim card absolute z-50 mt-1.5 max-h-64 w-full overflow-y-auto p-1.5 shadow-lift"
          >
            {placeholder && (
              <li>
                <button
                  type="button"
                  onClick={() => { onChange(''); setOpen(false); }}
                  className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm transition ${
                    !code ? 'bg-azure-soft' : 'hover:bg-canvas'
                  }`}
                >
                  <span className="flex-1 text-muted">{placeholder}</span>
                  {!code && <Check className="h-4 w-4 shrink-0 text-azure" strokeWidth={2.2} />}
                </button>
              </li>
            )}
            {courses.map((c) => {
              const token = unitToken(c.unit?.type);
              const active = c.code === code;
              return (
                <li key={c.code}>
                  <button
                    type="button"
                    onClick={() => { onChange(c.code); setOpen(false); }}
                    className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm transition ${
                      active ? 'bg-azure-soft' : 'hover:bg-canvas'
                    }`}
                  >
                    <span className={`chip ${token.bg} ${token.text}`}>{c.code}</span>
                    <span className="min-w-0 flex-1 truncate">{pick(c, 'title')}</span>
                    {active && <Check className="h-4 w-4 shrink-0 text-azure" strokeWidth={2.2} />}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
