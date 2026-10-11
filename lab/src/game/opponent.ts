import type { Strike } from './hero/HeroLayer'
import type { Camera, FrameInfo } from './types'

/** Ce qui fait face au personnage : le mannequin d'entraînement ou l'adversaire. Le moteur les traite de la même façon. */
export interface Opponent {
  /** Position sur le stage, en fraction de la largeur de l'écran. */
  readonly x: number
  /** Distance entre son axe et la surface de son corps côté personnage, en pixels de la toile. */
  readonly surface: number
  /** Distance minimale entre son axe et le point d'appui du personnage, en pixels de la toile. */
  readonly gap: number
  load(): Promise<boolean>
  /** Encaisse un coup. `power` : de 0 (effleuré) à 1 (coup fort). */
  hit(power: number): void
  /** Lance son attaque, s'il en a une. */
  attack(): void
  /** Son attaque, si elle peut toucher à cet instant. `pixel` : largeur d'un pixel de la toile, en fraction de la largeur du stage. */
  strike(pixel: number): Strike | null
  /** Son attaque a touché ou a été parée : elle ne touchera plus. */
  land(): void
  update(frame: FrameInfo): void
  draw(frame: FrameInfo, camera: Camera, calm: boolean): void
}
