import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DOUBLE_TAP_MS, DoubleTap, bindPlayerKeys, playerKey } from './controls'
import type { PlayerTarget } from './controls'

/** Un moteur factice qui note ce qu'on lui demande. */
function fakeTarget() {
  const calls: string[] = []
  const target: PlayerTarget = {
    walk: 0,
    crouch: false,
    block: false,
    dash: (direction) => calls.push(`dash ${direction}`),
    jump: () => calls.push('jump'),
    attack: () => calls.push('attack'),
    special: () => calls.push('special'),
    groundSpecial: () => calls.push('groundSpecial'),
    skipCinematic: () => calls.push('skip'),
  }
  return { target, calls }
}

/** Une frappe au clavier, envoyée à la fenêtre (une simple cible d'événements dans les tests). */
function press(type: 'keydown' | 'keyup', key: string, at = 0, repeat = false): Event {
  const event = new Event(type, { cancelable: true })
  for (const [name, value] of Object.entries({ key, timeStamp: at, repeat, ctrlKey: false, metaKey: false, altKey: false, target: null })) {
    Object.defineProperty(event, name, { value })
  }
  window.dispatchEvent(event)
  return event
}

describe('touches du joueur', () => {
  it('reconnaît les touches AZERTY et QWERTY', () => {
    expect(playerKey('ArrowRight')).toEqual({ kind: 'walk', direction: 1 })
    expect(playerKey('q')).toEqual({ kind: 'walk', direction: -1 })
    expect(playerKey('A')).toEqual({ kind: 'walk', direction: -1 })
    expect(playerKey('z')).toEqual({ kind: 'jump' })
    expect(playerKey('w')).toEqual({ kind: 'jump' })
    expect(playerKey('j')).toEqual({ kind: 'attack' })
    expect(playerKey('i')).toEqual({ kind: 'groundSpecial' })
    expect(playerKey('o')).toBeNull()
  })

  it('repère le double appui dans le même sens et dans le délai', () => {
    const taps = new DoubleTap()
    expect(taps.tap(1, 0)).toBe(false)
    expect(taps.tap(1, DOUBLE_TAP_MS - 1)).toBe(true)
    expect(taps.tap(1, 1000)).toBe(false)
    expect(taps.tap(-1, 1010)).toBe(false)
    expect(taps.tap(1, 1020)).toBe(false)
    expect(taps.tap(1, 1020 + DOUBLE_TAP_MS + 1)).toBe(false)
  })
})

describe('bindPlayerKeys', () => {
  let unbind = () => {}
  beforeEach(() => {
    Object.defineProperty(globalThis, 'window', { value: new EventTarget(), configurable: true })
  })
  afterEach(() => {
    unbind()
  })

  it('tient la marche, l’accroupi et la parade tant que la touche est enfoncée', () => {
    const { target } = fakeTarget()
    unbind = bindPlayerKeys(target)
    expect(press('keydown', 'ArrowRight').defaultPrevented).toBe(true)
    expect(target.walk).toBe(1)
    press('keydown', ' ')
    expect(target.block).toBe(true)
    press('keyup', 'ArrowRight')
    press('keyup', ' ')
    expect(target.walk).toBe(0)
    expect(target.block).toBe(false)
    press('keydown', 's')
    expect(target.crouch).toBe(true)
  })

  it('lance un dash au double appui, et les coups une fois par appui', () => {
    const { target, calls } = fakeTarget()
    unbind = bindPlayerKeys(target)
    press('keydown', 'd', 0)
    press('keyup', 'd', 50)
    press('keydown', 'd', 120)
    press('keydown', 'j', 200)
    press('keydown', 'j', 220, true)
    press('keydown', 'Escape', 300)
    expect(calls).toEqual(['dash 1', 'attack', 'skip'])
  })

  it('n’écoute pas tant que le jeu n’est pas actif', () => {
    const { target, calls } = fakeTarget()
    let active = false
    unbind = bindPlayerKeys(target, () => active)
    press('keydown', 'j')
    expect(calls).toEqual([])
    active = true
    press('keydown', 'j')
    expect(calls).toEqual(['attack'])
  })
})
