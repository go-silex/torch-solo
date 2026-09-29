/**
 * Slug de titre — module PUR (importable côté client pour les aperçus).
 * Convention vault : ASCII sans accents ni espaces, Title_Case avec underscores.
 */
export function slugifyTitle(title: string): string {
  const ascii = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // diacritiques combinants (accents)
    .replace(/[œŒ]/g, "oe")
    .replace(/[æÆ]/g, "ae");
  const words = ascii
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1));
  return words.join("_") || "Sans_Titre";
}
