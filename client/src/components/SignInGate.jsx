import { LogIn } from 'lucide-react';
import { useLang } from '../lib/i18n.jsx';
import { useStudent } from '../lib/student.jsx';

/** Drop-in "sign in to use this" prompt for features that need a student account. */
export default function SignInGate({ label }) {
  const { t } = useLang();
  const { openAuth } = useStudent();

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-hair px-4 py-6 text-center">
      <span className="grid h-9 w-9 place-items-center rounded-full bg-azure-soft text-azure">
        <LogIn className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
      </span>
      <p className="text-sm text-muted">{label || t('account.gateHint')}</p>
      <button type="button" onClick={openAuth} className="btn-primary text-sm">
        {t('account.signIn')}
      </button>
    </div>
  );
}
