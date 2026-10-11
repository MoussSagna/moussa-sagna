const PETAL_COUNT = 9;

/** Quelques pétales de cerisier en CSS. Purement décoratif, masqué si l'utilisateur réduit les animations. */
export function Petals() {
  return (
    <div className="petals" aria-hidden="true">
      {Array.from({ length: PETAL_COUNT }, (_, index) => (
        <span key={index} className="petals__petal" />
      ))}
    </div>
  );
}
