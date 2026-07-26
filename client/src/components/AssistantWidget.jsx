import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MessageCircle, Send, Sparkles, X } from 'lucide-react';
import { useLang } from '../lib/i18n.jsx';
import { api } from '../lib/api.js';
import { useStudent } from '../lib/student.jsx';
import ModulePicker from './ModulePicker.jsx';
import SignInGate from './SignInGate.jsx';

export default function AssistantWidget({ curriculum, semester }) {
  const { t, lang } = useLang();
  const { student } = useStudent();
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

            {!student ? (
              <div className="mt-3 flex flex-1 items-center justify-center">
                <SignInGate />
              </div>
            ) : (
              <>
                <p className="mt-1 font-mono text-xs uppercase tracking-[.14em] text-muted">
                  {semester === 0 ? t('stats.whole') : `${t('sem.s')} ${semester}`} · {courses.length} {t('assistant.modules')}
                </p>

                <div className="mt-3">
                  <ModulePicker courses={courses} code={code} onChange={(c) => { setCode(c); setMessages([]); }} />
                </div>

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
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
