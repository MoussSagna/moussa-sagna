/**
 * Clavier du joueur, sans React : les touches de Moussa, celles d'un combat (pas les touches d'essai du lab, ni le
 * contrôle de l'adversaire). Le site les branche sur le moteur avec `bindPlayerKeys` ; le lab garde pour l'instant sa
 * propre lecture du clavier, dans `App.tsx`, qui y ajoute ses touches d'essai.
 */

/** Ce qu'une touche commande. */
export type PlayerKey =
  | { kind: 'walk'; direction: 1 | -1 }
  | { kind: 'crouch' }
  | { kind: 'block' }
  | { kind: 'jump' }
  | { kind: 'attack' }
  | { kind: 'special' }
  | { kind: 'groundSpecial' }

/** Touches, par valeur de `KeyboardEvent.key` en minuscules. Q et A, Z et W couvrent les claviers AZERTY et QWERTY. */
const KEYS: Record<string, PlayerKey> = {
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
  l: { kind: 'special' },
  i: { kind: 'groundSpecial' },
}

/** Deux appuis sur la même direction en moins de ce délai (millisecondes) déclenchent un dash (ou un drive rush). */
export const DOUBLE_TAP_MS = 260

/** La commande d'une touche, ou `null` si le jeu ne s'en sert pas. */
export function playerKey(key: string): PlayerKey | null {
  return KEYS[key.toLowerCase()] ?? null
}

/**
 * Vrai si le jeu doit laisser passer cette frappe : raccourci du navigateur, saisie de texte, ou Espace sur un
 * bouton ou une case qui a le focus, où elle garde son rôle habituel.
 */
export function leavesKeyAlone(event: KeyboardEvent): boolean {
  if (event.ctrlKey || event.metaKey || event.altKey) return true
  const target = event.target
  const typing =
    (typeof HTMLInputElement !== 'undefined' && target instanceof HTMLInputElement && target.type !== 'checkbox') ||
    (typeof HTMLTextAreaElement !== 'undefined' && target instanceof HTMLTextAreaElement) ||
    (typeof HTMLElement !== 'undefined' && target instanceof HTMLElement && target.isContentEditable)
  const control =
    event.key === ' ' &&
    ((typeof HTMLButtonElement !== 'undefined' && target instanceof HTMLButtonElement) ||
      (typeof HTMLInputElement !== 'undefined' && target instanceof HTMLInputElement))
  return typing || control
}

/** Repère le double appui : `tap` renvoie vrai au second appui rapproché dans le même sens. */
export class DoubleTap {
  private last = { direction: 0, at: 0 }

  tap(direction: number, now: number): boolean {
    if (this.last.direction === direction && now - this.last.at < DOUBLE_TAP_MS) {
      this.last = { direction: 0, at: 0 }
      return true
    }
    this.last = { direction, at: now }
    return false
  }
}

/** Ce que le clavier commande : le moteur (`StageEngine`) a exactement ces champs et ces méthodes. */
export interface PlayerTarget {
  walk: number
  crouch: boolean
  block: boolean
  dash(direction: number): void
  jump(): void
  attack(): void
  special(): void
  groundSpecial(): void
  skipCinematic(): void
}

/**
 * Branche le clavier sur le moteur. Les touches tenues (marche, accroupi, parade) sont recalculées à chaque appui
 * et relâchement ; les appuis (double appui du dash, saut, coups) appellent le moteur. Échap passe la cinématique.
 * `active` dit si le jeu écoute (faux pendant l'écran de chargement). Renvoie la fonction qui débranche tout.
 */
export function bindPlayerKeys(target: PlayerTarget, active: () => boolean = () => true): () => void {
  const held = new Set<string>()
  const taps = new DoubleTap()
  const sync = () => {
    let direction = 0
    let crouch = false
    let block = false
    for (const key of held) {
      const command = KEYS[key]
      if (command?.kind === 'walk') direction = command.direction
      else if (command?.kind === 'crouch') crouch = true
      else if (command?.kind === 'block') block = true
    }
    target.walk = direction
    target.crouch = crouch
    target.block = block
  }
  const down = (event: KeyboardEvent) => {
    if (!active()) return
    const key = event.key.toLowerCase()
    if (key === 'escape') {
      target.skipCinematic()
      return
    }
    const command = KEYS[key]
    if (!command || leavesKeyAlone(event)) return
    // les flèches et Espace ne font plus défiler la page
    event.preventDefault()
    if (command.kind === 'walk' || command.kind === 'crouch' || command.kind === 'block') {
      // l'heure de l'événement, pas celle de son traitement : le double appui reste détecté quand l'affichage rame
      if (command.kind === 'walk' && !event.repeat && taps.tap(command.direction, event.timeStamp)) target.dash(command.direction)
      held.add(key)
      sync()
      return
    }
    if (event.repeat) return
    if (command.kind === 'jump') target.jump()
    else if (command.kind === 'attack') target.attack()
    else if (command.kind === 'special') target.special()
    else target.groundSpecial()
  }
  const up = (event: KeyboardEvent) => {
    held.delete(event.key.toLowerCase())
    sync()
  }
  const release = () => {
    held.clear()
    sync()
  }
  window.addEventListener('keydown', down)
  window.addEventListener('keyup', up)
  window.addEventListener('blur', release)
  return () => {
    window.removeEventListener('keydown', down)
    window.removeEventListener('keyup', up)
    window.removeEventListener('blur', release)
    release()
  }
}
