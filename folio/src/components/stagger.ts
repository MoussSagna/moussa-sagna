import type { CSSProperties } from 'react';

/** Rang d'un élément dans une apparition en cascade (variable CSS `--i`). */
export function stagger(index: number): CSSProperties {
  return { '--i': index } as CSSProperties;
}
