import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

type Variant = 'primary' | 'secondary';

interface ArcadeLinkProps {
  to: string;
  variant?: Variant;
  children: ReactNode;
}

/** Lien interne présenté comme un bouton d'arcade. */
export function ArcadeLink({ to, variant = 'primary', children }: ArcadeLinkProps) {
  return (
    <Link className={`btn btn--${variant}`} to={to}>
      <span className="btn__label">{children}</span>
    </Link>
  );
}

interface ExternalActionProps {
  /** URL de destination ; `null` si elle n'a pas encore été fournie. */
  href: string | null;
  label: string;
  /** Texte affiché à la place du lien tant que l'URL manque. */
  missingLabel: string;
  variant?: Variant;
}

/** Lien externe (ou `mailto:`). Sans URL, un bouton désactivé indique clairement que le lien n'est pas disponible. */
export function ExternalAction({ href, label, missingLabel, variant = 'secondary' }: ExternalActionProps) {
  if (!href) {
    return (
      <button className="btn btn--disabled" type="button" disabled>
        <span className="btn__label">{missingLabel}</span>
      </button>
    );
  }
  const isMail = href.startsWith('mailto:');
  return (
    <a
      className={`btn btn--${variant}`}
      href={href}
      {...(isMail ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
    >
      <span className="btn__label">
        {label}
        {!isMail && <span className="sr-only"> (nouvel onglet)</span>}
      </span>
    </a>
  );
}
