import { STAGE_BACKGROUND_URL } from '../assets';

interface StageBackdropProps {
  /** Zone du décor à garder visible quand l'image est recadrée. */
  focus?: 'moon' | 'plaza' | 'left' | 'right';
  /** Intensité du voile sombre posé sur le décor pour garder les textes lisibles. */
  dim?: 'light' | 'medium' | 'heavy';
  /** `fixed` : le décor reste en place pendant le défilement de la page. */
  fixed?: boolean;
}

/** Décor signature du site. L'image est toujours recadrée (cover), jamais étirée. */
export function StageBackdrop({ focus = 'moon', dim = 'medium', fixed = false }: StageBackdropProps) {
  return (
    <div className={`backdrop backdrop--${dim}${fixed ? ' backdrop--fixed' : ''}`} aria-hidden="true">
      <img className={`backdrop__image backdrop__image--${focus}`} src={STAGE_BACKGROUND_URL} alt="" />
    </div>
  );
}
