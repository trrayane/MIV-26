import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, MessageCircle, Send, Sparkles, X } from 'lucide-react';
import { useLang } from '../lib/i18n.jsx';
import { api } from '../lib/api.js';
import { unitToken } from './ui.jsx';

function ModulePicker({ courses, code, onChange }) {
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
    <div ref={ref} className="relative mt-3">
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
          <span className="flex-1 text-muted">—</span>
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

export default function AssistantWidget({ curriculum, semester }) {
  const { t, lang } = useLang();
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.assistantStatus().then((s) => setEnabled(s.enabled)).catch(() => setEnabled(false));
  }, []);

  const courses = useMemo(
    () => (curriculum ?? []).flatMap((s) => s.units.flatMap((u) => u.courses)),
    [curriculum]
  );

  useEffect(() => {
    if (!courses.length) return setCode('');
    if (!courses.some((c) => c.code === code)) {
      setCode(courses[0].code);
      setMessages([]);
    }
  }, [courses, code]);

  if (!enabled) return null;

  const ask = async (e) => {
    e.preventDefault();
    const q = question.trim();
    if (!q || busy || !code) return;
    setBusy(true);
    setError(null);
    setMessages((m) => [...m, { role: 'user', text: q }]);
    setQuestion('');
    try {
      const { answer } = await api.askAssistant(code, q, lang);
      setMessages((m) => [...m, { role: 'assistant', text: answer }]);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setOpen((o) => !o)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-label={t('assistant.title')}
        className="fixed bottom-5 right-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-azure text-white shadow-lift"
      >
        {open ? <X className="h-5 w-5" strokeWidth={2} /> : <MessageCircle className="h-6 w-6" strokeWidth={1.9} />}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.2 }}
            className="card fixed bottom-24 right-5 z-40 flex h-[80vh] max-h-[720px] w-[94vw] max-w-lg flex-col p-5 shadow-lift"
          >
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-azure-soft text-azure">
                <Sparkles className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
              </span>
              <p className="font-display text-sm font-semibold uppercase tracking-[.1em] text-muted">
                {t('assistant.title')}
              </p>
            </div>

            <p className="mt-1 font-mono text-xs uppercase tracking-[.14em] text-muted">
              {semester === 0 ? t('stats.whole') : `${t('sem.s')} ${semester}`} · {courses.length} {t('assistant.modules')}
            </p>

            <ModulePicker courses={courses} code={code} onChange={(c) => { setCode(c); setMessages([]); }} />

            <div className="scroll-slim mt-3 min-h-[80px] flex-1 space-y-3 overflow-y-auto">
              {messages.length === 0 && (
                <p className="text-xs text-muted">{t('assistant.hint')}</p>
              )}
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

            <form onSubmit={ask} className="mt-3 flex items-center gap-2">
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
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
