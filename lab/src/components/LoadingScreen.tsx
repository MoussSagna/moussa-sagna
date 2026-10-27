import { useEffect, useRef, useState } from 'react'
import { asset, onLoadProgress } from '@game/gl'

interface Props {
  /** Vrai quand le moteur a fini de charger toutes ses images. */
  ready: boolean
  /** Le joueur lance la partie : l'écran s'efface et la cinématique d'entrée commence. */
  onStart: () => void
  /** L'écran a fini de s'effacer : il peut être retiré. */
  onDone: () => void
}

/** Délai entre la jauge pleine et le lancement de la partie, en millisecondes. */
const AUTO_START_MS = 900

/** Astuces affichées pendant le chargement, une à la fois. */
const TIPS = [
  'J enchaîne les coups : léger, moyen, fort, puis le coup de pied.',
  'L lance la boule de feu, I déclenche la frappe au sol.',
  'Maintiens Espace pour parer : chaque parade coûte un peu de drive.',
  'Deux appuis rapides sur une flèche font un dash.',
  'Un coup touche ? Deux appuis rapides vers l\'avant : drive rush, pour 2 blocs de drive.',
  'Shigaraki lit tes mouvements. Garde tes distances.',
]

/**
 * Écran de chargement, à la manière des jeux de combat : les deux combattants face à face sur un fond partagé en
 * rouge et violet, « VS » au centre, et une jauge qui suit le vrai chargement des images du jeu. Une fois tout
 * chargé, la partie se lance d'elle-même.
 */
export function LoadingScreen({ ready, onStart, onDone }: Props) {
  const [progress, setProgress] = useState(0)
  const [tip, setTip] = useState(0)
  const [leaving, setLeaving] = useState(false)
  const shown = useRef(0)
  const started = useRef(false)

  // la jauge suit les images arrivées ; elle ne recule jamais et attend la fin du chargement pour atteindre 100 %
  useEffect(
    () =>
      onLoadProgress((done, started) => {
        const k = started > 0 ? done / started : 0
        shown.current = Math.max(shown.current, Math.min(0.97, k))
        setProgress(shown.current)
      }),
    [],
  )
  const value = ready ? 1 : progress

  useEffect(() => {
    const timer = window.setInterval(() => setTip((current) => (current + 1) % TIPS.length), 3200)
    return () => window.clearInterval(timer)
  }, [])

  const start = () => {
    if (!ready || started.current) return
    started.current = true
    setLeaving(true)
    // la cinématique démarre tout de suite, derrière l'écran, qui s'efface par-dessus : le stage n'apparaît jamais
    onStart()
    window.setTimeout(onDone, 450)
  }

  // tout est chargé : la jauge reste pleine un instant, puis la partie se lance d'elle-même
  useEffect(() => {
    if (!ready) return
    const timer = window.setTimeout(start, AUTO_START_MS)
    return () => window.clearTimeout(timer)
  })

  return (
    <div
      className={`loading absolute inset-0 z-10 overflow-hidden bg-ink ${ready ? 'is-ready' : ''} ${leaving ? 'is-leaving' : ''}`}
      role="dialog"
      aria-label="Chargement du jeu"
    >
      <div className="loading-bg absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${asset('loading/bg.webp')})` }} />
      <div className="loading-shade absolute inset-0" />

      <img className="loading-fighter loading-hero absolute bottom-0 left-[3%] h-[96%] w-auto" src={asset('loading/hero.webp')} alt="Moussa" draggable={false} />
      <img className="loading-fighter loading-rival absolute right-[3%] bottom-0 h-[96%] w-auto" src={asset('loading/rival.webp')} alt="Shigaraki" draggable={false} />

      <div className="loading-vs pointer-events-none absolute top-[30%] left-1/2 font-display leading-none italic" aria-hidden="true">
        VS
      </div>

      <div className="loading-name loading-name-hero pointer-events-none absolute bottom-[5%] left-[4%] flex flex-col">
        <span className="font-display text-[clamp(18px,4.2vw,64px)] leading-none text-line uppercase italic">Mouss</span>
        <span className="font-body text-[clamp(10px,1.3vw,20px)] font-bold tracking-[0.3em] text-blood uppercase italic">Combattant</span>
      </div>
      <div className="loading-name loading-name-rival pointer-events-none absolute right-[4%] bottom-[5%] flex flex-col items-end text-right">
        <span className="font-display text-[clamp(18px,4.2vw,64px)] leading-none text-line uppercase italic">Shigaraki</span>
        <span className="font-body text-[clamp(10px,1.3vw,20px)] font-bold tracking-[0.3em] text-violet uppercase italic">Le boss final</span>
      </div>

      <div className="loading-panel absolute inset-x-[27%] bottom-[7%] flex flex-col items-center gap-[0.6em] text-[clamp(10px,1.25vw,19px)]">
        <div className="flex w-full items-baseline justify-between font-body font-bold tracking-[0.25em] uppercase italic">
          <span className="loading-status flex items-center gap-[0.6em]" aria-live="polite">
            <span className="loading-spinner" aria-hidden="true" />
            {ready ? 'Prêt' : 'Chargement'}
            {!ready && <span className="loading-dots" aria-hidden="true" />}
          </span>
          <span className="tabular-nums">{Math.round(value * 100)} %</span>
        </div>
        <div
          className="loading-bar relative h-[0.9em] w-full"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(value * 100)}
          aria-label="Chargement des images du jeu"
        >
          <div className="loading-fill absolute inset-y-0 left-0" style={{ width: `${value * 100}%` }} />
        </div>
        {ready ? (
          <p className="loading-start m-0 font-display text-[1.7em] leading-none tracking-[0.06em] whitespace-nowrap text-line uppercase italic">Fight!</p>
        ) : (
          <p key={tip} className="loading-tip m-0 text-center font-body text-muted">
            {TIPS[tip]}
          </p>
        )}
      </div>
    </div>
  )
}
