import type { ReactNode } from 'react';
import { stagger } from './stagger';

interface HudPanelProps {
  label?: string;
  accent?: 'red' | 'violet' | 'cyan';
  className?: string;
  children: ReactNode;
}

/** Panneau à coins marqués, inspiré des cadres d'interface de jeu de combat. */
export function HudPanel({ label, accent = 'red', className, children }: HudPanelProps) {
  return (
    <div className={`hud hud--${accent}${className ? ` ${className}` : ''}`}>
      {label && <p className="hud__label">{label}</p>}
      {children}
    </div>
  );
}

/** Signale un contenu qui reste à fournir, sans le remplacer par un texte inventé. */
export function Pending({ children }: { children: ReactNode }) {
  return (
    <p className="pending">
      <span className="pending__tag">À compléter</span>
      <span>{children}</span>
    </p>
  );
}

interface PageHeadProps {
  eyebrow: string;
  title: string;
  lead?: string;
}

export function PageHead({ eyebrow, title, lead }: PageHeadProps) {
  return (
    <header className="page-head">
      <p className="eyebrow rise">{eyebrow}</p>
      <h1 className="display page-head__title rise" style={stagger(1)}>
        {title}
      </h1>
      {lead && (
        <p className="page-head__lead rise" style={stagger(2)}>
          {lead}
        </p>
      )}
    </header>
  );
}
