import { Link } from 'react-router-dom';
import { ArrowUpRight, Github, Globe, Linkedin, ShieldCheck } from 'lucide-react';

const SOCIALS = [
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/rayane-terki-334b19378/', Icon: Linkedin },
  { label: 'GitHub', href: 'https://github.com/trrayane', Icon: Github },
  { label: 'Portfolio', href: 'https://portdolio-beta.vercel.app/', Icon: Globe },
];
import { useLang } from '../lib/i18n.jsx';
import { Logo } from './ui.jsx';

export default function Footer({ program }) {
  const { t } = useLang();
  const l = program?.links ?? {};

  const quick = [
    [t('footer.ent'), l.ent],
    [t('footer.virtual'), l.campusVirtuel],
    [t('footer.schedule'), l.emploiDuTemps],
    [t('footer.exams'), l.examens],
    [t('footer.library'), l.bibliotheque],
    [t('footer.pfe'), l.pfe],
  ].filter(([, href]) => Boolean(href));

  return (
    <footer className="mt-20 border-t border-hair bg-surface/60 backdrop-blur">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 md:grid-cols-[1.2fr_1fr]">
        <div>
          <div className="flex items-center gap-3">
            <Logo className="h-9 w-9" />
            <div className="leading-tight">
              <p className="font-display text-sm font-semibold">Master Informatique Visuelle</p>
              <p className="font-mono text-xs uppercase tracking-[.16em] text-muted">USTHB · {program?.accreditation ?? '2021-2022'}</p>
            </div>
          </div>
          <p className="mt-4 max-w-md text-xs leading-relaxed text-muted">{t('footer.note')}</p>
          <Link to="/admin" className="btn-ghost mt-4 px-3 py-2 text-xs">
            <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.9} />
            {t('nav.admin')}
          </Link>
        </div>

        <nav aria-label={t('footer.links')}>
          <p className="font-mono text-xs uppercase tracking-[.18em] text-muted">{t('footer.links')}</p>
          <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
            {quick.map(([label, href]) => (
              <li key={label}>
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="group inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-azure"
                >
                  {label}
                  <ArrowUpRight className="h-3.5 w-3.5 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" strokeWidth={2} />
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="border-t border-hair/70">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-mono text-xs uppercase tracking-[.14em] text-muted">
            © {new Date().getFullYear()} · Master Informatique Visuelle · USTHB
          </span>
          <div className="flex items-center gap-1">
            {SOCIALS.map(({ label, href, Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noreferrer"
                aria-label={label}
                title={label}
                className="rounded-lg p-2 text-muted transition hover:bg-azure-soft hover:text-azure"
              >
                <Icon className="h-4 w-4" strokeWidth={1.9} />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
