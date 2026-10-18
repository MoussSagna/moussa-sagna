import { useEffect, useRef, useState } from 'react'
import { asset } from '../game/gl'
import { StageEngine } from '../game/stage/StageEngine'
import type { StageOptions } from '../game/types'

const STAGE_NAME = 'Tokyo Underground'
/** Durée du carton de titre, en millisecondes (alignée sur l'animation CSS). */
const CARD_MS = 3300

interface Props {
  options: StageOptions
  /** Change de valeur pour rejouer l'intro. */
  introKey: number
  /** Déplacement du personnage : 1 vers l'avant, -1 vers l'arrière, 0 à l'arrêt. */
  walk: number
  /** Vrai tant que le personnage doit rester accroupi. */
  crouch: boolean
  /** Vrai tant que le personnage doit parer. */
  block: boolean
  /** Adversaire contrôlé par le joueur : déplacement (-1 vers Moussa, 1 en s'éloignant, 0 à l'arrêt) et parade. */
  rivalWalk: number
  rivalBlock: boolean
  /** Dash demandé pour l'adversaire contrôlé : `id` change à chaque demande, `direction` (1 ou -1, à l'écran). Il se téléporte vers le personnage ou en s'éloignant. */
  rivalDash: { id: number; direction: number }
  /** Dash demandé : `id` change à chaque demande, `direction` vaut 1 ou -1. */
  dash: { id: number; direction: number }
  /** Change de valeur à chaque saut demandé. */
  jump: number
  /** Change de valeur à chaque appui sur la touche d'attaque. */
  attack: number
  /** Change de valeur à chaque attaque spéciale demandée. */
  special: number
  /** Change de valeur à chaque seconde attaque spéciale (frappe au sol) demandée. */
  special2: number
  /** Change de valeur à chaque K.O. demandé (le personnage perd le round). */
  knockOut: number
  /** Change de valeur à chaque fin de round demandée. */
  endRound: number
  /** Change de valeur à chaque attaque demandée au mannequin. */
  dummyAttack: number
  /** Change de valeur à chaque coup spécial demandé pour l'adversaire. */
  rivalSpecial: number
  /** Change de valeur à chaque attaque ultime demandée pour l'adversaire. */
  rivalUltimate: number
  onUnavailable?: () => void
}

/** L'écran du stage : décor animé, personnage en garde, météo et carton de titre. */
export function StageScreen({ options, introKey, walk, crouch, block, rivalWalk, rivalBlock, rivalDash, dash, jump, attack, special, special2, knockOut, endRound, dummyAttack, rivalSpecial, rivalUltimate, onUnavailable }: Props) {
  const root = useRef<HTMLDivElement>(null)
  const backdrop = useRef<HTMLCanvasElement>(null)
  const dummy = useRef<HTMLCanvasElement>(null)
  const rival = useRef<HTMLCanvasElement>(null)
  const hero = useRef<HTMLCanvasElement>(null)
  const weather = useRef<HTMLCanvasElement>(null)
  const cinematic = useRef<HTMLCanvasElement>(null)
  /** Vrai pendant les plans illustrés de la cinématique d'entrée, qu'on peut alors passer. */
  const [cinematicPlaying, setCinematicPlaying] = useState(false)
  const engine = useRef<StageEngine | null>(null)
  // l'intro est en cours tant que le carton de la dernière demande n'est pas terminé
  const [finishedKey, setFinishedKey] = useState(-1)
  const intro = finishedKey !== introKey

  useEffect(() => {
    if (!root.current || !backdrop.current || !dummy.current || !rival.current || !hero.current || !weather.current || !cinematic.current) return
    const instance = new StageEngine(root.current, {
      backdrop: backdrop.current,
      dummy: dummy.current,
      rival: rival.current,
      hero: hero.current,
      weather: weather.current,
      cinematic: cinematic.current,
    })
    instance.onCinematic = setCinematicPlaying
    engine.current = instance
    let cancelled = false
    instance.run().then((ok) => {
      if (!ok && !cancelled) onUnavailable?.()
    })
    return () => {
      cancelled = true
      instance.destroy()
      engine.current = null
    }
  }, [onUnavailable])

  useEffect(() => {
    if (engine.current) engine.current.options = options
  }, [options])

  useEffect(() => {
    if (engine.current) engine.current.walk = walk
  }, [walk])

  useEffect(() => {
    if (engine.current) engine.current.crouch = crouch
  }, [crouch])

  useEffect(() => {
    if (engine.current) engine.current.block = block
  }, [block])

  useEffect(() => {
    if (engine.current) engine.current.rivalWalk = rivalWalk
  }, [rivalWalk])

  useEffect(() => {
    if (engine.current) engine.current.rivalBlock = rivalBlock
  }, [rivalBlock])

  useEffect(() => {
    if (rivalDash.id > 0) engine.current?.rivalDash(rivalDash.direction)
  }, [rivalDash])

  useEffect(() => {
    if (dash.id > 0) engine.current?.dash(dash.direction)
  }, [dash])

  useEffect(() => {
    if (jump > 0) engine.current?.jump()
  }, [jump])

  useEffect(() => {
    if (attack > 0) engine.current?.attack()
  }, [attack])

  useEffect(() => {
    if (special > 0) engine.current?.special()
  }, [special])

  useEffect(() => {
    if (special2 > 0) engine.current?.groundSpecial()
  }, [special2])

  useEffect(() => {
    if (knockOut > 0) engine.current?.knockOut()
  }, [knockOut])

  useEffect(() => {
    if (endRound > 0) engine.current?.endRound()
  }, [endRound])

  useEffect(() => {
    if (dummyAttack > 0) engine.current?.dummyAttack()
  }, [dummyAttack])

  useEffect(() => {
    if (rivalSpecial > 0) engine.current?.rivalSpecial()
  }, [rivalSpecial])

  useEffect(() => {
    if (rivalUltimate > 0) engine.current?.rivalUltimate()
  }, [rivalUltimate])

  // Échap passe la cinématique
  useEffect(() => {
    if (!cinematicPlaying) return
    const skip = (event: KeyboardEvent) => {
      if (event.key === 'Escape') engine.current?.skipCinematic()
    }
    window.addEventListener('keydown', skip)
    return () => window.removeEventListener('keydown', skip)
  }, [cinematicPlaying])

  useEffect(() => {
    if (introKey > 0) engine.current?.replayIntro()
    const timer = window.setTimeout(() => setFinishedKey(introKey), CARD_MS)
    return () => window.clearTimeout(timer)
  }, [introKey])

  return (
    <div
      ref={root}
      className={`relative aspect-[1672/941] w-full overflow-hidden bg-[#0b0812] bg-cover bg-center outline-2 outline-[#2a2233] ${intro ? 'is-intro' : ''}`}
      style={{ backgroundImage: `url(${asset('stage/stage.webp')})` }}
    >
      <canvas
        ref={backdrop}
        className="absolute inset-0 block size-full"
        aria-label="Stage Tokyo Underground : une cour de temple sous la pluie, lune rouge, cerisier en fleurs et ville au néon"
      />
      <canvas ref={dummy} className="pointer-events-none absolute inset-0 block size-full" aria-label="Mannequin d'entraînement" />
      <canvas ref={rival} className="pointer-events-none absolute inset-0 block size-full" aria-label="L'adversaire en garde" />
      <canvas ref={hero} className="pointer-events-none absolute inset-0 block size-full" aria-label="Moussa en garde" />
      <canvas ref={weather} className="pointer-events-none absolute inset-0 block size-full" aria-hidden="true" />

      <div key={`flash-${introKey}`} className="stage-flash pointer-events-none absolute inset-0 bg-white" />
      <div className="stage-bar stage-bar-top pointer-events-none absolute inset-x-0 top-0 h-[8%] bg-black" />
      <div className="stage-bar stage-bar-bottom pointer-events-none absolute inset-x-0 bottom-0 h-[8%] bg-black" />

      <div
        key={`card-${introKey}`}
        className="stage-card pointer-events-none absolute inset-x-0 top-1/2 flex flex-col items-center gap-[0.25em] text-[clamp(20px,6.2vw,96px)]"
        aria-hidden="true"
      >
        <span className="pl-[0.5em] font-body text-[0.2em] font-bold tracking-[0.5em] text-blood uppercase italic">Stage</span>
        <span className="px-[0.2em] font-display leading-none whitespace-nowrap text-line uppercase italic [text-shadow:.04em_.04em_0_var(--color-blood),-.02em_-.02em_0_#000]">
          {STAGE_NAME}
        </span>
        <span className="stage-slash h-[0.09em] w-[62%] bg-blood" />
      </div>

      <div className="stage-tag pointer-events-none absolute top-[3.4%] left-[2.4%] flex flex-col gap-[0.15em] text-[clamp(11px,2.1vw,30px)]">
        <span className="text-[0.42em] font-bold tracking-[0.4em] text-blood uppercase italic">Stage</span>
        <span className="font-display leading-none uppercase italic [text-shadow:.06em_.06em_0_#000]">{STAGE_NAME}</span>
        <span className="h-[0.12em] w-full -skew-x-[30deg] bg-blood" />
      </div>

      <canvas ref={cinematic} className="pointer-events-none absolute inset-0 block size-full" aria-hidden="true" />
      {cinematicPlaying && (
        <button
          type="button"
          onClick={() => engine.current?.skipCinematic()}
          className="absolute right-[2.4%] bottom-[10%] min-h-11 -skew-x-[10deg] cursor-pointer border-2 border-line/60 bg-black/50 px-4 font-display text-[17px] tracking-wide text-line uppercase italic hover:border-line"
        >
          Passer <span className="font-body text-[13px] normal-case not-italic opacity-70">(Échap)</span>
        </button>
      )}
    </div>
  )
}
