const STORAGE_KEY = 'tokyo-underground:intro-seen';

/** Le stockage peut être indisponible (navigation privée, réglages) : l'intro est alors simplement rejouée. */
export function hasSeenIntro(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markIntroSeen(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // Sans stockage, rien à mémoriser.
  }
}
