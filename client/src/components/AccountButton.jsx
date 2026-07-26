import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, LogOut, RefreshCw, User, X } from 'lucide-react';
import { useLang } from '../lib/i18n.jsx';
import { useStudent } from '../lib/student.jsx';

export default function AccountButton() {
  const { t } = useLang();
  const { student, ready, syncing, login, register, logout } = useStudent();
  const [open, setOpen] = useState(false);

  if (!ready) return null;

  const initial = (student?.name || student?.email || '?').trim().charAt(0).toUpperCase();

  return (
    <>
      {student ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="grid h-9 w-9 place-items-center rounded-full border border-hair bg-surface font-display text-sm font-semibold text-azure transition hover:border-azure"
          aria-label={t('account.title')}
          title={student.email}
        >
          {initial}
        </button>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="btn-ghost px-3 py-2 text-sm">
          <User className="h-4 w-4" strokeWidth={1.8} />
          <span className="hidden sm:inline">{t('account.signIn')}</span>
        </button>
      )}

      {createPortal(
        <AnimatePresence>
          {open && (
            <AccountModal
              onClose={() => setOpen(false)}
              student={student}
              syncing={syncing}
              login={login}
              register={register}
              logout={logout}
            />
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}

function AccountModal({ onClose, student, syncing, login, register, logout }) {
  const { t } = useLang();
  const [mode, setMode] = useState('login'); // login | register
  const [form, setForm] = useState({ email: '', password: '', name: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'register') await register(form.email, form.password, form.name);
      else await login(form.email, form.password);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={t('account.title')}
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 300, damping: 26 }}
        className="card relative w-full max-w-sm p-6"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t('account.close')}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-muted transition hover:bg-azure-soft hover:text-azure"
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>

        {student ? (
          <div>
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-azure-soft text-azure">
              <User className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
            </span>
            <h2 className="mt-4 font-display text-xl font-semibold tracking-tight">{t('account.title')}</h2>
            <p className="mt-1 text-sm text-muted">
              {t('account.loggedInAs')} · <span className="font-medium text-ink">{student.email}</span>
            </p>
            <p className="mt-4 flex items-center gap-2 font-mono text-xs uppercase tracking-[.12em] text-signal">
              {syncing ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" strokeWidth={2} aria-hidden="true" />
              ) : (
                <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
              )}
              {syncing ? t('account.syncing') : t('account.synced')}
            </p>
            <button type="button" onClick={() => { logout(); onClose(); }} className="btn-ghost mt-5 w-full text-sm">
              <LogOut className="h-4 w-4" strokeWidth={1.8} />
              {t('account.logout')}
            </button>
          </div>
        ) : (
          <div>
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-azure-soft text-azure">
              <User className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
            </span>
            <h2 className="mt-4 font-display text-xl font-semibold tracking-tight">
              {mode === 'register' ? t('account.register') : t('account.login')}
            </h2>
            <p className="mt-1.5 text-sm text-muted">{t('account.subtitle')}</p>

            <form onSubmit={submit} className="mt-5 space-y-3">
              {mode === 'register' && (
                <div>
                  <label className="label" htmlFor="acc-name">{t('account.name')}</label>
                  <input
                    id="acc-name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="field"
                    autoComplete="given-name"
                  />
                </div>
              )}
              <div>
                <label className="label" htmlFor="acc-email">{t('account.email')}</label>
                <input
                  id="acc-email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="field"
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="label" htmlFor="acc-pw">{t('account.password')}</label>
                <input
                  id="acc-pw"
                  type="password"
                  required
                  minLength={6}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="field"
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                />
              </div>

              {error && <p className="text-xs text-azure-deep">{error}</p>}

              <button type="submit" disabled={busy} className="btn-primary w-full">
                {mode === 'register' ? t('account.register') : t('account.login')}
              </button>
            </form>

            <button
              type="button"
              onClick={() => { setMode(mode === 'register' ? 'login' : 'register'); setError(null); }}
              className="mt-4 w-full text-center font-mono text-xs uppercase tracking-[.12em] text-muted transition hover:text-azure"
            >
              {mode === 'register' ? t('account.toLogin') : t('account.toRegister')}
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
