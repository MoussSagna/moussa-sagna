/**
 * L'IA de Shigaraki : à chaque image, elle regarde le combat (`RivalView`) et décide de ce que ferait un joueur
 * (`RivalOrders`) : avancer ou reculer, parer, lancer un coup. Le moteur applique ces ordres avec les mêmes commandes
 * que l'adversaire contrôlé au clavier. Sans React ni rendu : rien que des décisions.
 *
 * Elle ne triche pas : elle ne voit les coups de Moussa qu'après un temps de réaction, ne pare pas à tous les coups,
 * et réfléchit à intervalles irréguliers, comme un joueur. Les distances sont en pixels de la toile du personnage
 * (celle des portées des coups : 580 pour le coup de poing de Shigaraki, 820 pour son coup spécial).
 */

/** Ce que l'IA voit du combat. */
export interface RivalView {
  /** Distance entre son axe et l'avant du corps de Moussa. */
  space: number
  /** Distance entre l'avant de son corps et la boule de feu de Moussa, si elle vole vers lui. */
  fireball: number | null
  heroAttacking: boolean
  heroStunned: boolean
  heroBlocking: boolean
  heroAirborne: boolean
  /** Moussa est K.O. ou le round se termine : plus rien à faire. */
  over: boolean
  /** Il peut agir (en garde ou en lévitation, ni en plein coup, ni sonné). */
  free: boolean
  /** Il est en plein coup, et ce coup a touché ou a été paré. */
  attacking: boolean
  connected: boolean
  /** Sa barre de super est pleine : l'attaque ultime est possible. */
  superFull: boolean
}

export type RivalAction = 'attack' | 'special' | 'ultimate' | 'dashIn' | 'dashOut'

/** Ce que l'IA demande : `walk` -1 vers Moussa, 1 en reculant, 0 à l'arrêt. */
export interface RivalOrders {
  walk: number
  block: boolean
  action: RivalAction | null
}

/**
 * Réglages. `think` : intervalle entre deux décisions, en secondes (tiré au hasard entre les deux bornes).
 * `react` : temps de réaction à la boule de feu. `reach` : portée de son coup de poing et de son coup spécial ;
 * `threat` : distance sous laquelle les coups de Moussa peuvent le toucher. `block` : durée d'une parade tenue.
 * Les chances sont des probabilités, à chaque décision.
 */
export const BRAIN = {
  think: [0.14, 0.32] as [number, number],
  react: [0.16, 0.28] as [number, number],
  reach: { punch: 620, special: 860 },
  threat: 900,
  block: [0.35, 0.7] as [number, number],
  walkHold: [0.25, 0.6] as [number, number],
  chances: {
    /** Contre la boule de feu : parer, sinon se téléporter vers Moussa pour passer à travers. */
    fireballBlock: 0.65,
    fireballDash: 0.2,
    /** Au corps à corps : frapper, coup spécial, parer par précaution, reculer. Le reste du temps, il attend. */
    closeAttack: 0.45,
    closeSpecial: 0.12,
    closeBlock: 0.25,
    closeBack: 0.08,
    /** Moussa attaque à portée : il pare plus souvent. */
    underFireBlock: 0.55,
    /** À mi-distance : coup spécial, avancer, se téléporter vers lui, reculer. */
    midSpecial: 0.25,
    midWalk: 0.5,
    midDash: 0.1,
    midBack: 0.05,
    /** De loin : avancer, se téléporter. */
    farWalk: 0.7,
    farDash: 0.18,
    /** Barre de super pleine et Moussa à portée sans parer. */
    ultimate: 0.35,
    /** Son coup a touché : il enchaîne le suivant, ou finit par le coup spécial. Paré : il continue parfois. */
    chainOnHit: 0.75,
    specialOnHit: 0.15,
    chainOnBlock: 0.3,
  },
}

const between = ([low, high]: [number, number]) => low + Math.random() * (high - low)

export class RivalBrain {
  private thinkLeft = 0
  private walk = 0
  private walkLeft = 0
  private blockLeft = 0
  /** Réaction prévue à la boule de feu en vol : délai restant, puis ce qu'il fera. */
  private dodge: { left: number; action: 'block' | 'dash' | 'none' } | null = null
  private sawFireball = false
  private wasConnected = false

  /** Nouveau round : il oublie tout. */
  reset(): void {
    this.thinkLeft = 0
    this.walk = 0
    this.walkLeft = 0
    this.blockLeft = 0
    this.dodge = null
    this.sawFireball = false
    this.wasConnected = false
  }

  /** Une image : `delta` en secondes de combat (zéro pendant un arrêt sur image, où il ne pense pas). */
  think(view: RivalView, delta: number): RivalOrders {
    const orders: RivalOrders = { walk: 0, block: false, action: null }
    if (view.over) {
      this.reset()
      return orders
    }
    this.thinkLeft -= delta
    this.walkLeft -= delta
    this.blockLeft -= delta
    if (this.walkLeft <= 0) this.walk = 0
    const { chances } = BRAIN

    // enchaînement : quand son coup vient de toucher (ou d'être paré), il décide une fois de la suite
    if (view.connected && !this.wasConnected) {
      const roll = Math.random()
      if (view.heroStunned) {
        if (roll < chances.chainOnHit) orders.action = 'attack'
        else if (roll < chances.chainOnHit + chances.specialOnHit) orders.action = 'special'
      } else if (roll < chances.chainOnBlock) orders.action = 'attack'
    }
    this.wasConnected = view.connected

    // la boule de feu : il la voit arriver, et réagit après un temps de réaction
    if (view.fireball !== null && view.fireball < 1400 && !this.sawFireball) {
      this.sawFireball = true
      const roll = Math.random()
      const action = roll < chances.fireballBlock ? 'block' : roll < chances.fireballBlock + chances.fireballDash ? 'dash' : 'none'
      this.dodge = { left: between(BRAIN.react), action }
    }
    if (view.fireball === null) this.sawFireball = false
    if (this.dodge) {
      this.dodge.left -= delta
      if (this.dodge.left <= 0) {
        if (this.dodge.action === 'block') this.blockLeft = Math.max(this.blockLeft, 0.6)
        else if (this.dodge.action === 'dash' && view.free) orders.action = 'dashIn'
        this.dodge = null
      }
    }

    // une décision de temps en temps, quand il est libre d'agir
    if (this.thinkLeft <= 0 && view.free && orders.action === null) {
      this.thinkLeft = between(BRAIN.think)
      this.decide(view, orders)
    }

    orders.walk = this.blockLeft > 0 ? 0 : this.walk
    orders.block = this.blockLeft > 0 && !view.attacking
    return orders
  }

  private decide(view: RivalView, orders: RivalOrders): void {
    const { chances, reach } = BRAIN
    const roll = Math.random()
    // Moussa sonné à portée : il en profite
    if (view.heroStunned && view.space < reach.punch) {
      orders.action = 'attack'
      return
    }
    if (view.superFull && view.space < reach.punch && !view.heroBlocking && !view.heroAirborne && roll < chances.ultimate) {
      orders.action = 'ultimate'
      return
    }
    // Moussa attaque et il est à portée : il pare plus souvent
    if (view.heroAttacking && view.space < BRAIN.threat && roll < chances.underFireBlock) {
      this.holdBlock()
      return
    }
    if (view.space < reach.punch) {
      let k = chances.closeAttack
      if (roll < k) orders.action = 'attack'
      else if (roll < (k += chances.closeSpecial)) orders.action = 'special'
      else if (roll < (k += chances.closeBlock)) this.holdBlock()
      else if (roll < (k += chances.closeBack)) this.hold(1)
      else this.hold(0)
      return
    }
    if (view.space < reach.special) {
      let k = chances.midSpecial
      if (roll < k) orders.action = 'special'
      else if (roll < (k += chances.midWalk)) this.hold(-1)
      else if (roll < (k += chances.midDash)) orders.action = 'dashIn'
      else if (roll < (k += chances.midBack)) this.hold(1)
      else this.hold(0)
      return
    }
    if (roll < chances.farWalk) this.hold(-1)
    else if (roll < chances.farWalk + chances.farDash) orders.action = 'dashIn'
    else this.hold(0)
  }

  /** Marche dans ce sens un moment (ou attend, à 0). */
  private hold(direction: number): void {
    this.walk = direction
    this.walkLeft = between(BRAIN.walkHold)
  }

  /** Tient la parade un moment. */
  private holdBlock(): void {
    this.blockLeft = between(BRAIN.block)
    this.walk = 0
  }
}
