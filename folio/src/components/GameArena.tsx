import { useCallback, useEffect, useRef, useState } from 'react';
import { bindPlayerKeys } from '@game/controls';
import { asset } from '@game/gl';
import { StageEngine } from '@game/stage/StageEngine';
import { ArenaLoading } from './ArenaLoading';

const reducedMotion = '(prefers-reduced-motion: reduce)';

/**
 * L'arène : le moteur du lab (`../game/`), tel quel. Ses plans sont des canvas superposés (décor, mannequin caché,
 * Shigaraki, Moussa, météo, cinématique et interface), que le moteur dimensionne lui-même. Le clavier est branché
 * par `bindPlayerKeys`, et n'écoute qu'une fois la partie lancée. Seul fichier du site qui touche au moteur ; il
 * est chargé à la demande depuis la page de l'arène.
 */
export default function GameArena() {
  const root = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLCanvasElement>(null);
  const dummy = useRef<HTMLCanvasElement>(null);
  const rival = useRef<HTMLCanvasElement>(null);
  const hero = useRef<HTMLCanvasElement>(null);
  const weather = useRef<HTMLCanvasElement>(null);
  const cinematic = useRef<HTMLCanvasElement>(null);
  const engine = useRef<StageEngine | null>(null);
  const playing = useRef(false);
  const [ready, setReady] = useState(false);
  const [loadingGone, setLoadingGone] = useState(false);
  /** Vrai pendant les plans illustrés de la cinématique d'entrée, qu'on peut alors passer. */
  const [cinematicPlaying, setCinematicPlaying] = useState(false);

  useEffect(() => {
    if (!root.current || !backdrop.current || !dummy.current || !rival.current || !hero.current || !weather.current || !cinematic.current) {
      return;
    }
    const instance = new StageEngine(root.current, {
      backdrop: backdrop.current,
      dummy: dummy.current,
      rival: rival.current,
      hero: hero.current,
      weather: weather.current,
      cinematic: cinematic.current,
    });
    // « Réduire les animations » du système suit ses changements pendant la partie
    const query = window.matchMedia(reducedMotion);
    instance.options = { rain: true, petals: true, calm: query.matches, opponent: 'rival' };
    const onMotion = (event: MediaQueryListEvent) => {
      instance.options = { ...instance.options, calm: event.matches };
    };
    query.addEventListener('change', onMotion);
    instance.onCinematic = setCinematicPlaying;
    engine.current = instance;
    let cancelled = false;
    void instance.run().then(() => {
      if (!cancelled) {
        setReady(true);
      }
    });
    const unbind = bindPlayerKeys(instance, () => playing.current);
    return () => {
      cancelled = true;
      unbind();
      query.removeEventListener('change', onMotion);
      instance.destroy();
      engine.current = null;
    };
  }, []);

  // la cinématique démarre tout de suite, derrière l'écran de chargement qui s'efface par-dessus
  const onStart = useCallback(() => {
    playing.current = true;
    engine.current?.replayIntro();
  }, []);
  const onLoadingDone = useCallback(() => setLoadingGone(true), []);

  return (
    <div ref={root} className="game-stage" style={{ backgroundImage: `url(${asset('stage/stage.webp')})` }}>
      <canvas
        ref={backdrop}
        className="game-stage__layer"
        aria-label="Arène Tokyo Underground : une cour de temple sous la pluie, lune rouge, cerisier en fleurs et ville au néon. Moussa y affronte Shigaraki."
      />
      <canvas ref={dummy} className="game-stage__layer" aria-hidden="true" />
      <canvas ref={rival} className="game-stage__layer" aria-hidden="true" />
      <canvas ref={hero} className="game-stage__layer" aria-hidden="true" />
      <canvas ref={weather} className="game-stage__layer" aria-hidden="true" />
      <canvas ref={cinematic} className="game-stage__layer" aria-hidden="true" />
      {cinematicPlaying && (
        <button type="button" className="game-stage__skip" onClick={(event) => {
          event.currentTarget.blur();
          engine.current?.skipCinematic();
        }}>
          Passer <span className="game-stage__skip-key">(Échap)</span>
        </button>
      )}
      {!loadingGone && <ArenaLoading ready={ready} onStart={onStart} onDone={onLoadingDone} />}
    </div>
  );
}
