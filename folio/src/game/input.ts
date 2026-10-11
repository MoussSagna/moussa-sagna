/** Ce qu'une touche commande dans l'arène. */
export type KeyCommand =
  | { kind: 'walk'; direction: 1 | -1 }
  | { kind: 'crouch' }
  | { kind: 'block' }
  | { kind: 'jump' }
  | { kind: 'attack' };

/**
 * Touches de l'arène, par valeur de `KeyboardEvent.key` en minuscules. Q et A, Z et W couvrent les
 * claviers AZERTY et QWERTY.
 */
const KEYS: Record<string, KeyCommand> = {
  arrowright: { kind: 'walk', direction: 1 },
  d: { kind: 'walk', direction: 1 },
  arrowleft: { kind: 'walk', direction: -1 },
  q: { kind: 'walk', direction: -1 },
  a: { kind: 'walk', direction: -1 },
  arrowdown: { kind: 'crouch' },
  s: { kind: 'crouch' },
  ' ': { kind: 'block' },
  arrowup: { kind: 'jump' },
  z: { kind: 'jump' },
  w: { kind: 'jump' },
  j: { kind: 'attack' },
};

/** La commande d'une touche, ou `null` si l'arène ne s'en sert pas. */
export function keyCommand(key: string): KeyCommand | null {
  return KEYS[key.toLowerCase()] ?? null;
}

/**
 * Vrai si l'arène doit laisser passer cette frappe : raccourci du navigateur, saisie de texte, ou
 * Espace sur un bouton ou une case qui a le focus, où elle garde son rôle habituel.
 */
export function leavesKeyAlone(event: KeyboardEvent): boolean {
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return true;
  }
  const target = event.target;
  const typing =
    (target instanceof HTMLInputElement && target.type !== 'checkbox') ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable);
  const control = event.key === ' ' && (target instanceof HTMLButtonElement || target instanceof HTMLInputElement);
  return typing || control;
}

interface KeyboardHandlers {
  /** Un appui (pas la répétition d'une touche maintenue) sur une direction, avec l'heure de l'événement. */
  onTap: (direction: number, at: number) => void;
  onJump: () => void;
  onAttack: () => void;
}

/**
 * Clavier de l'arène. Les touches maintenues (marche, accroupi, parade) se lisent à chaque image ; les
 * appuis (double appui du dash, saut, attaque) sont signalés par les fonctions fournies.
 * Les touches de l'arène n'ont plus leur effet habituel dans la page : les flèches haut et bas et Espace
 * ne la font pas défiler tant que l'arène est affichée.
 */
export class ArenaKeyboard {
  private held = new Set<string>();
  private handlers: KeyboardHandlers;

  constructor(handlers: KeyboardHandlers) {
    this.handlers = handlers;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.release);
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.release);
    this.held.clear();
  }

  /** Direction maintenue : la dernière touche de marche enfoncée l'emporte. */
  get direction(): number {
    let direction = 0;
    for (const key of this.held) {
      const command = KEYS[key];
      if (command?.kind === 'walk') {
        direction = command.direction;
      }
    }
    return direction;
  }

  get crouch(): boolean {
    return this.holds('crouch');
  }

  get block(): boolean {
    return this.holds('block');
  }

  private holds(kind: KeyCommand['kind']): boolean {
    for (const key of this.held) {
      if (KEYS[key]?.kind === kind) {
        return true;
      }
    }
    return false;
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    const key = event.key.toLowerCase();
    const command = KEYS[key];
    if (!command || leavesKeyAlone(event)) {
      return;
    }
    event.preventDefault();
    if (command.kind === 'jump' || command.kind === 'attack') {
      if (!event.repeat) {
        (command.kind === 'jump' ? this.handlers.onJump : this.handlers.onAttack)();
      }
      return;
    }
    // l'heure de l'événement, pas celle de son traitement : le double appui reste détecté quand l'affichage rame
    if (command.kind === 'walk' && !event.repeat) {
      this.handlers.onTap(command.direction, event.timeStamp);
    }
    this.held.add(key);
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    this.held.delete(event.key.toLowerCase());
  };

  private release = (): void => {
    this.held.clear();
  };
}
