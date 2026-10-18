import { useCallback, useEffect, useRef, useState } from 'react'
import { StageScreen } from './components/StageScreen'
import type { StageOptions } from './game/types'

const prefersCalm = window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Touches de déplacement. Q et A couvrent les claviers AZERTY et QWERTY. */
const KEYS: Record<string, number> = { arrowright: 1, d: 1, arrowleft: -1, q: -1, a: -1 }
/** Touches qui font s'accroupir tant qu'elles sont maintenues. */
const CROUCH_KEYS = new Set(['arrowdown', 's'])
/** Touches qui font parer tant qu'elles sont maintenues. */
const BLOCK_KEYS = new Set([' '])
/** Touches qui lancent un saut. Z et W couvrent les claviers AZERTY et QWERTY. */
const JUMP_KEYS = new Set(['arrowup', 'z', 'w'])
/** Touche d'attaque : un appui pour le coup léger, d'autres appuis pour enchaîner. */
const ATTACK_KEYS = new Set(['j'])
/** Touche de l'attaque spéciale. */
const SPECIAL_KEYS = new Set(['l'])
/** Touche de la seconde attaque spéciale, la frappe au sol. */
const SPECIAL2_KEYS = new Set(['i'])
/** Touche qui termine le round : le personnage disparaît, puis le round suivant commence. */
const END_ROUND_KEYS = new Set(['p'])
/** Touche qui met le personnage K.O., pour tester sa défaite. */
const KO_KEYS = new Set(['o'])
/** Touche qui fait attaquer le mannequin, pour tester les coups reçus et parés. */
const DUMMY_KEYS = new Set(['k'])
/** Touche du coup spécial de l'adversaire (Maj quand on le contrôle). */
const RIVAL_SPECIAL_KEYS = new Set(['m'])
/** Touche de l'attaque ultime de l'adversaire. */
const RIVAL_ULTIMATE_KEYS = new Set(['n'])
/**
 * Touches de l'adversaire, quand le joueur le contrôle : les flèches. Il regarde vers la gauche, donc ← le fait
 * avancer vers Moussa. ↓ le fait parer tant qu'elle est maintenue. Moussa garde alors Q D, S, Z et Espace.
 */
const RIVAL_KEYS: Record<string, number> = { arrowleft: -1, arrowright: 1 }
const RIVAL_BLOCK_KEYS = new Set(['arrowdown'])
const ARROWS = new Set(['arrowleft', 'arrowright', 'arrowup', 'arrowdown'])
/** Deux appuis sur la même direction en moins de ce délai (millisecondes) déclenchent un dash. */
const DOUBLE_TAP_MS = 260

function App() {
  const [options, setOptions] = useState<StageOptions>({ rain: true, petals: true, calm: prefersCalm, opponent: 'rival' })
  const [introKey, setIntroKey] = useState(0)
  const [walk, setWalk] = useState(0)
  const [crouch, setCrouch] = useState(false)
  const [block, setBlock] = useState(false)
  const [jump, setJump] = useState(0)
  const [attack, setAttack] = useState(0)
  const [special, setSpecial] = useState(0)
  const [special2, setSpecial2] = useState(0)
  const [endRound, setEndRound] = useState(0)
  const [knockOut, setKnockOut] = useState(0)
  const [dummyAttack, setDummyAttack] = useState(0)
  const [rivalSpecial, setRivalSpecial] = useState(0)
  const [rivalUltimate, setRivalUltimate] = useState(0)
  const [dash, setDash] = useState({ id: 0, direction: 1 })
  /** Vrai quand le joueur contrôle aussi l'adversaire, avec les flèches. */
  const [rivalControl, setRivalControl] = useState(false)
  const [rivalWalk, setRivalWalk] = useState(0)
  const [rivalBlock, setRivalBlock] = useState(false)
  const [rivalDash, setRivalDash] = useState({ id: 0, direction: -1 })
  /** Dernier appui sur une flèche pour l'adversaire : deux appuis rapprochés dans le même sens font un dash. */
  const rivalTap = useRef({ direction: 0, at: 0 })
  const lastTap = useRef({ direction: 0, at: 0 })
  const [note, setNote] = useState('Bouge la souris sur le décor pour sentir la profondeur.')

  const onUnavailable = useCallback(() => {
    setNote("Le décor animé n'a pas pu se charger : il reste fixe, seules la pluie et les pétales bougent.")
  }, [])
  /** Un appui sur une direction : le second appui rapproché dans le même sens lance un dash. */
  const tap = useCallback((direction: number, now = performance.now()) => {
    const last = lastTap.current
    if (last.direction === direction && now - last.at < DOUBLE_TAP_MS) {
      setDash((current) => ({ id: current.id + 1, direction }))
      lastTap.current = { direction: 0, at: 0 }
    } else {
      lastTap.current = { direction, at: now }
    }
  }, [])
  const toggle = (key: 'rain' | 'petals' | 'calm') => setOptions((current) => ({ ...current, [key]: !current[key] }))

  useEffect(() => {
    const held = new Set<string>()
    const rivalHeld = new Set<string>()
    const syncRival = () => {
      let direction = 0
      let guard = false
      for (const key of rivalHeld) {
        if (RIVAL_BLOCK_KEYS.has(key)) guard = true
        else direction = RIVAL_KEYS[key] ?? direction
      }
      setRivalWalk(direction)
      setRivalBlock(guard)
    }
    const sync = () => {
      let direction = 0
      let down = false
      let guard = false
      for (const key of held) {
        if (CROUCH_KEYS.has(key)) down = true
        else if (BLOCK_KEYS.has(key)) guard = true
        else direction = KEYS[key]
      }
      setWalk(direction)
      setCrouch(down)
      setBlock(guard)
    }
    const down = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      // adversaire contrôlé : les flèches sont à lui (↑ ne fait rien, il ne saute pas)
      if (rivalControl && (ARROWS.has(key) || key === 'enter' || key === 'shift')) {
        if (event.ctrlKey || event.metaKey || event.altKey) return
        const target = event.target
        if ((target instanceof HTMLInputElement && target.type !== 'checkbox') || target instanceof HTMLTextAreaElement) return
        event.preventDefault()
        if (key === 'arrowup') return
        // Entrée : son coup de poing
        if (key === 'shift') {
          if (!event.repeat) setRivalSpecial((count) => count + 1)
          return
        }
        if (key === 'enter') {
          if (!event.repeat) setDummyAttack((count) => count + 1)
          return
        }
        // deux appuis rapides dans le même sens : dash ; vers Moussa, il se téléporte
        const tapped = RIVAL_KEYS[key]
        if (tapped && !event.repeat) {
          const last = rivalTap.current
          if (last.direction === tapped && event.timeStamp - last.at < DOUBLE_TAP_MS) {
            setRivalDash((current) => ({ id: current.id + 1, direction: tapped }))
            rivalTap.current = { direction: 0, at: 0 }
          } else {
            rivalTap.current = { direction: tapped, at: event.timeStamp }
          }
        }
        rivalHeld.add(key)
        syncRival()
        return
      }
      const posture = CROUCH_KEYS.has(key) || BLOCK_KEYS.has(key)
      const jumping = JUMP_KEYS.has(key)
      const punching = ATTACK_KEYS.has(key) || SPECIAL_KEYS.has(key) || SPECIAL2_KEYS.has(key) || END_ROUND_KEYS.has(key) || KO_KEYS.has(key) || DUMMY_KEYS.has(key) || RIVAL_SPECIAL_KEYS.has(key) || RIVAL_ULTIMATE_KEYS.has(key)
      if ((!(key in KEYS) && !posture && !jumping && !punching) || event.ctrlKey || event.metaKey || event.altKey) return
      const target = event.target
      // on ne détourne les touches que hors des champs de saisie de texte
      const typing = (target instanceof HTMLInputElement && target.type !== 'checkbox') || target instanceof HTMLTextAreaElement
      // Espace garde son rôle habituel sur un bouton ou une case à cocher qui a le focus
      const control = key === ' ' && (target instanceof HTMLButtonElement || target instanceof HTMLInputElement)
      if (typing || control) return
      event.preventDefault()
      if (jumping || punching) {
        if (event.repeat) return
        if (jumping) setJump((count) => count + 1)
        else if (SPECIAL_KEYS.has(key)) setSpecial((count) => count + 1)
        else if (SPECIAL2_KEYS.has(key)) setSpecial2((count) => count + 1)
        else if (END_ROUND_KEYS.has(key)) setEndRound((count) => count + 1)
        else if (KO_KEYS.has(key)) setKnockOut((count) => count + 1)
        else if (DUMMY_KEYS.has(key)) setDummyAttack((count) => count + 1)
        else if (RIVAL_SPECIAL_KEYS.has(key)) setRivalSpecial((count) => count + 1)
        else if (RIVAL_ULTIMATE_KEYS.has(key)) setRivalUltimate((count) => count + 1)
        else setAttack((count) => count + 1)
        return
      }
      // l'heure de l'événement, pas celle de son traitement : le double appui reste détecté quand l'affichage rame
      if (!event.repeat && !posture) tap(KEYS[key], event.timeStamp)
      held.add(key)
      sync()
    }
    const up = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      held.delete(key)
      rivalHeld.delete(key)
      sync()
      syncRival()
    }
    const release = () => {
      held.clear()
      rivalHeld.clear()
      sync()
      syncRival()
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', release)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', release)
      // en changeant de mode, plus rien n'est tenu
      release()
    }
  }, [tap, rivalControl])

  return (
    <main className="mx-auto flex max-w-[1500px] flex-col gap-3.5 px-4 pt-4 pb-8">
      <h1 className="sr-only">Moussa Sagna, développeur frontend</h1>
      <StageScreen options={options} introKey={introKey} walk={walk} crouch={crouch} block={block} rivalWalk={rivalWalk} rivalBlock={rivalBlock} rivalDash={rivalDash} dash={dash} jump={jump} attack={attack} special={special} special2={special2} endRound={endRound} knockOut={knockOut} dummyAttack={dummyAttack} rivalSpecial={rivalSpecial} rivalUltimate={rivalUltimate} onUnavailable={onUnavailable} />

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-muted">
        <button
          type="button"
          onClick={() => setIntroKey((key) => key + 1)}
          className="min-h-11 -skew-x-[10deg] cursor-pointer bg-blood px-5 font-display text-[17px] tracking-wide text-white uppercase italic hover:bg-[#ff3d44]"
        >
          Rejouer l'intro
        </button>
        <Toggle label="Pluie" checked={options.rain} onChange={() => toggle('rain')} />
        <Toggle label="Pétales" checked={options.petals} onChange={() => toggle('petals')} />
        <Toggle
          label="Mannequin d'entraînement"
          checked={options.opponent !== 'rival'}
          onChange={() => {
            // le mannequin ne se contrôle pas : choisir le mannequin rend la main sur l'adversaire
            const dummy = options.opponent === 'rival'
            if (dummy) setRivalControl(false)
            setOptions((current) => ({ ...current, opponent: dummy ? 'dummy' : 'rival', rivalControl: dummy ? false : current.rivalControl }))
          }}
        />
        <Toggle
          label="Contrôler l'adversaire"
          checked={rivalControl}
          onChange={() => {
            // contrôler l'adversaire le fait apparaître à la place du mannequin
            setOptions((current) => ({ ...current, opponent: rivalControl ? current.opponent : 'rival', rivalControl: !rivalControl }))
            setRivalControl(!rivalControl)
          }}
        />
        <Toggle label="L'adversaire pare" checked={options.rivalBlocks === true} onChange={() => setOptions((current) => ({ ...current, rivalBlocks: !current.rivalBlocks }))} />
        <Toggle label="L'adversaire se déplace" checked={options.rivalMoves !== false} onChange={() => setOptions((current) => ({ ...current, rivalMoves: current.rivalMoves === false }))} />
        <Toggle label="Réduire les mouvements" checked={options.calm} onChange={() => toggle('calm')} />
      </div>
      <p className="m-0 text-[15px] text-muted">
        Maintiens <kbd className="border border-[#3a3145] bg-panel px-1.5 text-line">←</kbd>{' '}
        <kbd className="border border-[#3a3145] bg-panel px-1.5 text-line">→</kbd> ou{' '}
        <kbd className="border border-[#3a3145] bg-panel px-1.5 text-line">Q</kbd>{' '}
        <kbd className="border border-[#3a3145] bg-panel px-1.5 text-line">D</kbd> pour marcher, appuie deux fois vite pour un dash, maintiens{' '}
        <kbd className="border border-[#3a3145] bg-panel px-1.5 text-line">↓</kbd> ou{' '}
        <kbd className="border border-[#3a3145] bg-panel px-1.5 text-line">S</kbd> pour t'accroupir,{' '}
        <kbd className="border border-[#3a3145] bg-panel px-1.5 text-line">Espace</kbd> pour parer,{' '}
        <kbd className="border border-[#3a3145] bg-panel px-1.5 text-line">↑</kbd> ou{' '}
        <kbd className="border border-[#3a3145] bg-panel px-1.5 text-line">Z</kbd> pour sauter (avec une direction tenue : saut avant ou arrière),{' '}
        <kbd className="border border-[#3a3145] bg-panel px-1.5 text-line">J</kbd> pour attaquer : un appui pour le
        coup léger, puis d'autres pour enchaîner le coup moyen, le coup fort et le coup de pied ;{' '}
        <kbd className="border border-[#3a3145] bg-panel px-1.5 text-line">L</kbd> pour la boule de feu,{' '}
        <kbd className="border border-[#3a3145] bg-panel px-1.5 text-line">I</kbd> pour la frappe au sol,{' '}
        <kbd className="border border-[#3a3145] bg-panel px-1.5 text-line">P</kbd> pour finir le round,{' '}
        <kbd className="border border-[#3a3145] bg-panel px-1.5 text-line">O</kbd> pour perdre par K.O. ;{' '}
        <kbd className="border border-[#3a3145] bg-panel px-1.5 text-line">K</kbd> pour que le mannequin ou l'adversaire t'attaque, <kbd className="border border-[#3a3145] bg-panel px-1.5 text-line">M</kbd> pour son coup spécial, <kbd className="border border-[#3a3145] bg-panel px-1.5 text-line">N</kbd> pour son attaque ultime. {note}
      </p>
      {rivalControl && (
        <p className="m-0 text-[15px] text-line">
          Tu contrôles l'adversaire avec les flèches : maintiens <kbd className="border border-[#3a3145] bg-panel px-1.5 text-line">←</kbd> pour avancer vers Moussa (deux appuis rapides : il se téléporte, dans son dos s'il est au contact),{' '}
          <kbd className="border border-[#3a3145] bg-panel px-1.5 text-line">→</kbd> pour reculer (deux appuis rapides : il se téléporte en arrière) et <kbd className="border border-[#3a3145] bg-panel px-1.5 text-line">↓</kbd> pour parer, <kbd className="border border-[#3a3145] bg-panel px-1.5 text-line">Entrée</kbd> pour frapper, <kbd className="border border-[#3a3145] bg-panel px-1.5 text-line">Maj</kbd> pour son coup spécial. Moussa se joue alors avec <kbd className="border border-[#3a3145] bg-panel px-1.5 text-line">Q</kbd> <kbd className="border border-[#3a3145] bg-panel px-1.5 text-line">D</kbd>, <kbd className="border border-[#3a3145] bg-panel px-1.5 text-line">S</kbd>, <kbd className="border border-[#3a3145] bg-panel px-1.5 text-line">Z</kbd>, 
          <kbd className="border border-[#3a3145] bg-panel px-1.5 text-line">Espace</kbd> et les touches d'attaque.
        </p>
      )}
    </main>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-2">
      <input type="checkbox" checked={checked} onChange={onChange} className="size-[18px] accent-blood" />
      {label}
    </label>
  )
}

export default App
