import { fighterArtUrl } from '../data/fighters';
import type { Fighter } from '../data/fighters';

interface FighterPortraitProps {
  fighter: Fighter;
  variant: 'splash' | 'hero' | 'rival' | 'profile';
  /** Affiche l'étiquette (joueur, nom) sous le portrait. */
  showTag?: boolean;
}

/**
 * Visuel d'un combattant.
 * - `hero` ou `rival` avec un personnage en pied disponible : l'illustration détourée, posée sur le décor.
 * - sinon : le gros plan dans un cadre incliné, ou un emplacement stylisé tant que le visuel manque.
 */
export function FighterPortrait({ fighter, variant, showTag = false }: FighterPortraitProps) {
  const stance = variant === 'hero' || variant === 'rival' ? fighter.stance : null;
  const classes = [
    'fighter',
    `fighter--${fighter.id}`,
    `fighter--${variant}`,
    stance ? 'fighter--cutout' : '',
    fighter.mirrored ? 'fighter--mirrored' : '',
  ];

  return (
    <figure className={classes.filter(Boolean).join(' ')}>
      {stance ? (
        <img
          className="fighter__stance"
          src={fighterArtUrl(stance)}
          width={stance.width}
          height={stance.height}
          alt={`${fighter.name}, en pied`}
        />
      ) : (
        <div className="fighter__frame">
          {fighter.portrait ? (
            <img
              className="fighter__image"
              src={fighterArtUrl(fighter.portrait)}
              width={fighter.portrait.width}
              height={fighter.portrait.height}
              alt={`Portrait de ${fighter.name}`}
            />
          ) : (
            <div
              className="fighter__placeholder"
              role="img"
              aria-label={`Emplacement réservé (${fighter.name}) : visuel à fournir`}
            >
              <span className="fighter__initial" aria-hidden="true">
                {fighter.initial}
              </span>
              <span className="fighter__missing" aria-hidden="true">
                Visuel à fournir
              </span>
            </div>
          )}
        </div>
      )}
      {showTag && (
        <figcaption className="fighter__tag">
          <span className="fighter__slot">{fighter.slot}</span>
          <span className="fighter__name">{fighter.name}</span>
          <span className="fighter__tagline">{fighter.tagline}</span>
        </figcaption>
      )}
    </figure>
  );
}
