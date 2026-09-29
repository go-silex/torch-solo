/**
 * Date de publication réelle d'un post LinkedIn, lue dans son URL : l'id
 * d'activité (19 chiffres, `activity-…` ou `urn:li:activity:…`) encode
 * l'horodatage en millisecondes sur ses 41 bits de poids fort.
 * Module pur (serveur et client).
 */
export function linkedinPostDate(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/activity[-:](\d{18,20})/);
  if (!match) return null;
  const ms = Number(BigInt(match[1]) >> BigInt(22));
  const d = new Date(ms);
  if (Number.isNaN(d.getTime()) || d.getFullYear() < 2015) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Première date trouvable dans les URLs publiées (LinkedIn uniquement pour l'instant). */
export function publishedDateFromUrls(urls: Record<string, string | null>): string | null {
  return linkedinPostDate(urls.linkedin ?? null);
}
