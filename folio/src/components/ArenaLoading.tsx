import { useEffect, useRef, useState } from 'react';
import { asset, onLoadProgress } from '@game/gl';
import { LOADING_FIGHTERS, LOADING_TIPS } from '../data/arena';

interface ArenaLoadingProps {
  /** Vrai quand le moteur a fini de charger toutes ses images. */
  ready: boolean;
  /** La partie se lance : la cinématique démarre derrière l'écran, qui s'efface par-dessus. */
  onStart: () => void;
  /** L'écran a fini de s'effacer : il peut être retiré. */
  onDone: () => void;
}

/** Délai entre la jauge pleine et le lancement de la partie, en millisecondes. */
const AUTO_START_MS = 900;
/** Durée de l'effacement de l'écran (alignée sur l'animation CSS), en millisecondes. */
const LEAVE_MS = 450;
/** Durée d'affichage de chaque astuce, en millisecondes. */
const TIP_MS = 3200;

/**
 * Écran de chargement de l'arène, repris de celui du lab (`../lab/src/components/LoadingScreen.tsx`) : les deux
 * combattants face à face sur un fond partagé en rouge et violet, « VS », leurs noms, une astuce de jeu, et une
 * jauge qui suit le vrai chargement des images du jeu. Une fois tout chargé, la partie se lance d'elle-même.
 */
export function ArenaLoading({ ready, onStart, onDone }: ArenaLoadingProps) {
  const [progress, setProgress] = useState(0);
  const [tip, setTip] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const shown = useRef(0);
  const started = useRef(false);

  // la jauge suit les images arrivées ; elle ne recule jamais et attend la fin du chargement pour atteindre 100 %
  useEffect(
    () =>
      onLoadProgress((done, total) => {
        const k = total > 0 ? done / total : 0;
        shown.current = Math.max(shown.current, Math.min(0.97, k));
        setProgress(shown.current);
      }),
    [],
  );
  const value = ready ? 1 : progress;

  useEffect(() => {
    const timer = window.setInterval(() => setTip((current) => (current + 1) % LOADING_TIPS.length), TIP_MS);
    return () => window.clearInterval(timer);
  }, []);

  // tout est chargé : la jauge reste pleine un instant, puis la partie se lance d'elle-même
  useEffect(() => {
    if (!ready) {
      return;
    }
    const timer = window.setTimeout(() => {
      if (started.current) {
        return;
      }
      started.current = true;
      setLeaving(true);
      onStart();
      window.setTimeout(onDone, LEAVE_MS);
    }, AUTO_START_MS);
    return () => window.clearTimeout(timer);
  }, [ready, onStart, onDone]);

  const { hero, rival } = LOADING_FIGHTERS;
  const percent = Math.round(value * 100);
  return (
    <div className={`arena-loading${ready ? ' is-ready' : ''}${leaving ? ' is-leaving' : ''}`} role="dialog" aria-label="Chargement du jeu">
      <div className="arena-loading__bg" style={{ backgroundImage: `url(${asset('loading/bg.webp')})` }} />
      <div className="arena-loading__shade" />

      <img className="arena-loading__fighter arena-loading__fighter--hero" src={asset('loading/hero.webp')} alt={hero.name} draggable={false} />
      <img className="arena-loading__fighter arena-loading__fighter--rival" src={asset('loading/rival.webp')} alt={rival.name} draggable={false} />

      <p className="arena-loading__vs" aria-hidden="true">
        VS
      </p>

      <p className="arena-loading__name arena-loading__name--hero">
        <span className="arena-loading__fighter-name">{hero.name}</span>
        <span className="arena-loading__fighter-title">{hero.title}</span>
      </p>
      <p className="arena-loading__name arena-loading__name--rival">
        <span className="arena-loading__fighter-name">{rival.name}</span>
        <span className="arena-loading__fighter-title">{rival.title}</span>
      </p>

      <div className="arena-loading__panel">
        <div className="arena-loading__status">
          <span aria-live="polite">
            <span className="arena-loading__spinner" aria-hidden="true" />
            {ready ? 'Prêt' : 'Chargement'}
            {!ready && <span className="arena-loading__dots" aria-hidden="true" />}
          </span>
          <span className="arena-loading__percent">{percent} %</span>
        </div>
        <div className="arena-loading__bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="Chargement des images du jeu">
          <div className="arena-loading__fill" style={{ width: `${value * 100}%` }} />
        </div>
        {ready ? (
          <p className="arena-loading__start">Fight!</p>
        ) : (
          <p key={tip} className="arena-loading__tip">
            {LOADING_TIPS[tip]}
          </p>
        )}
      </div>
    </div>
  );
}
