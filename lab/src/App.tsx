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
/** Deux appuis sur la même direction en moins de ce délai (millisecondes) déclenchent un dash. */
const DOUBLE_TAP_MS = 260

function App() {
  const [options, setOptions] = useState<StageOptions>({ rain: true, petals: true, calm: prefersCalm })
  const [introKey, setIntroKey] = useState(0)
  const [walk, setWalk] = useState(0)
  const [crouch, setCrouch] = useState(false)
  const [block, setBlock] = useState(false)
  const [jump, setJump] = useState(0)
  const [attack, setAttack] = useState(0)
  const [dash, setDash] = useState({ id: 0, direction: 1 })
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
  const hold = (direction: number, held: boolean) => {
    if (held) tap(direction)
    setWalk(held ? direction : 0)
  }
  const toggle = (key: keyof StageOptions) => setOptions((current) => ({ ...current, [key]: !current[key] }))

  useEffect(() => {
    const held = new Set<string>()
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
      const posture = CROUCH_KEYS.has(key) || BLOCK_KEYS.has(key)
      const jumping = JUMP_KEYS.has(key)
      const punching = ATTACK_KEYS.has(key)
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
        else setAttack((count) => count + 1)
        return
      }
      // l'heure de l'événement, pas celle de son traitement : le double appui reste détecté quand l'affichage rame
      if (!event.repeat && !posture) tap(KEYS[key], event.timeStamp)
      held.add(key)
      sync()
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
    }
  }, [tap])

  return (
    <main className="mx-auto flex max-w-[1500px] flex-col gap-3.5 px-4 pt-4 pb-8">
      <h1 className="sr-only">Moussa Sagna, développeur frontend</h1>
      <StageScreen options={options} introKey={introKey} walk={walk} crouch={crouch} block={block} dash={dash} jump={jump} attack={attack} onUnavailable={onUnavailable} />

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-muted">
        <div className="flex gap-2">
          <HoldButton label="Reculer" onHold={(held) => hold(-1, held)} />
          <HoldButton label="Avancer" onHold={(held) => hold(1, held)} />
          <HoldButton label="S'accroupir" onHold={setCrouch} />
          <HoldButton label="Parer" onHold={setBlock} />
          <HoldButton label="Sauter" onHold={(held) => held && setJump((count) => count + 1)} />
          <HoldButton label="Attaquer" onHold={(held) => held && setAttack((count) => count + 1)} />
        </div>
        <button
          type="button"
          onClick={() => setIntroKey((key) => key + 1)}
          className="min-h-11 -skew-x-[10deg] cursor-pointer bg-blood px-5 font-display text-[17px] tracking-wide text-white uppercase italic hover:bg-[#ff3d44]"
        >
          Rejouer l'intro
        </button>
        <Toggle label="Pluie" checked={options.rain} onChange={() => toggle('rain')} />
        <Toggle label="Pétales" checked={options.petals} onChange={() => toggle('petals')} />
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
        <kbd className="border border-[#3a3145] bg-panel px-1.5 text-line">Z</kbd> pour sauter,{' '}
        <kbd className="border border-[#3a3145] bg-panel px-1.5 text-line">J</kbd> pour attaquer : un appui pour le
        coup léger, puis d'autres pour enchaîner le coup moyen et le coup fort. {note}
      </p>
    </main>
  )
}

/** Bouton à maintenir : la marche dure tant que le doigt ou la souris reste appuyé. */
function HoldButton({ label, onHold }: { label: string; onHold: (held: boolean) => void }) {
  return (
    <button
      type="button"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId)
        onHold(true)
      }}
      onPointerUp={() => onHold(false)}
      onPointerCancel={() => onHold(false)}
      onKeyDown={(event) => {
        if (event.key === ' ' || event.key === 'Enter') onHold(true)
      }}
      onKeyUp={() => onHold(false)}
      onBlur={() => onHold(false)}
      className="min-h-11 -skew-x-[10deg] cursor-pointer touch-none border-2 border-[#3a3145] bg-panel px-4 font-display text-[17px] tracking-wide text-line uppercase italic select-none hover:border-line"
    >
      {label}
    </button>
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
