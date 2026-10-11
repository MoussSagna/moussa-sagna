import { useEffect } from 'react';

const SITE_NAME = 'Tokyo Underground';

export function usePageTitle(title?: string): void {
  useEffect(() => {
    document.title = title ? `${title} — ${SITE_NAME}` : `${SITE_NAME} — Moussa, Creative Developer`;
  }, [title]);
}
