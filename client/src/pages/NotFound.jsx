import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { useLang } from '../lib/i18n.jsx';
import { Logo } from '../components/ui.jsx';

export default function NotFound() {
  const { t } = useLang();

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-6xl flex-col items-center justify-center px-5 py-16 text-center">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="card flex max-w-md flex-col items-center p-8"
      >
        <Logo className="h-12 w-12" />
        <p className="mt-5 font-mono text-xs uppercase tracking-[.2em] text-azure">404</p>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">{t('notfound.title')}</h1>
        <p className="mt-2 text-sm text-muted">{t('notfound.lead')}</p>
        <Link to="/" className="btn-primary mt-6">
          <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
          {t('notfound.back')}
        </Link>
      </motion.div>
    </div>
  );
}
