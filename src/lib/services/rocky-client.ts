import { getSetting } from "@/lib/config";
import type { ContentFrontmatter } from "@/lib/types/content";

/**
 * Client Rocky (rocky.gosilex.com) — génération des vignettes d'illustration.
 *
 * Rocky est la SSOT de la DA illustrée (perso Rocky, palette, grain) : on lui
 * délègue le prompt et le modèle plutôt que de dupliquer son moteur ici, sinon
 * les deux dérivent. Auth = mot de passe partagé → cookie de session (le même
 * que dans le navigateur), stocké en mémoire et renouvelé sur 401.
 */

const BASE = () =>
  (getSetting("ROCKY_BASE_URL") ?? "https://rocky.gosilex.com").replace(/\/$/, "");

export class RockyError extends Error {}

export function rockyConfigured(): boolean {
  return Boolean(getSetting("ROCKY_PASSWORD"));
}

let cachedCookie: string | null = null;

async function login(): Promise<string> {
  const password = getSetting("ROCKY_PASSWORD");
  if (!password) {
    throw new RockyError(
      "Rocky non configuré : ajoute ROCKY_PASSWORD dans ~/.config/torch/torch.env",
    );
  }
  const res = await fetch(`${BASE()}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    throw new RockyError(
      res.status === 401
        ? "Mot de passe Rocky refusé (ROCKY_PASSWORD dans torch.env)."
        : `Rocky ${res.status} au login`,
    );
  }
  const setCookie = res.headers.get("set-cookie");
  const cookie = setCookie?.split(";")[0];
  if (!cookie) throw new RockyError("Rocky n'a pas renvoyé de cookie de session.");
  cachedCookie = cookie;
  return cookie;
}

async function withSession<T>(
  call: (cookie: string) => Promise<Response>,
  parse: (res: Response) => Promise<T>,
): Promise<T> {
  let cookie = cachedCookie ?? (await login());
  let res = await call(cookie);
  if (res.status === 401) {
    // Session expirée (30 j) : on se reconnecte une fois.
    cachedCookie = null;
    cookie = await login();
    res = await call(cookie);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new RockyError(`Rocky ${res.status} : ${body.slice(0, 200)}`);
  }
  return parse(res);
}

/**
 * Preset de format Rocky adapté au contenu : la plateforme prime (c'est là que
 * l'image sera vue), le format de contenu sert de repli.
 */
export function formatIdFor(fm: ContentFrontmatter): string {
  const p = fm.platforms;
  if (p.includes("youtube")) return "youtube";
  if (p.includes("reels")) return "instagram-story";
  if (p.includes("linkedin")) return "linkedin-carre";
  switch (fm.format) {
    case "episode":
      return "youtube";
    case "short":
      return "instagram-story";
    case "post":
      return "linkedin-carre";
    default:
      return "paysage";
  }
}

/**
 * Sujet envoyé à Rocky : le corps de la note s'il dit quelque chose (son moteur
 * accepte « un post LinkedIn complet ou un sujet court »), sinon le titre.
 * On retire le balisage markdown, qui n'apporte rien au prompt visuel.
 */
export function topicFor(fm: ContentFrontmatter, body: string): string {
  const prose = body
    .replace(/^---[\s\S]*?---/, "")
    .split("\n")
    .filter((l) => !/^\s*#{1,6}\s/.test(l))
    .join("\n")
    .replace(/[*_`>]/g, "")
    .replace(/!?\[\[?([^\]]*?)\]\]?(\([^)]*\))?/g, "$1")
    .trim();
  const topic = prose.length > 40 ? `${fm.title}\n\n${prose}` : fm.title;
  return topic.slice(0, 4000);
}

export type RockyImage = {
  /** data:image/png;base64,… */
  dataUrl: string;
  /** Id de l'asset archivé sur le Drive Rocky (null si archivage désactivé). */
  assetId: string | null;
};

/** Génère UNE illustration (pas de grille de sélection : on régénère si besoin). */
export async function generateIllustration(
  topic: string,
  formatId: string,
): Promise<RockyImage> {
  const form = new FormData();
  form.set("mode", "scene");
  form.set("topic", topic);
  form.set("quality", "medium");
  form.set("formatId", formatId);
  form.set("count", "1");

  type GenResponse = {
    variants?: { image: string | null; error: string | null; assetId: string | null }[];
    error?: string;
  };

  const data = await withSession(
    (cookie) =>
      fetch(`${BASE()}/api/generate`, {
        method: "POST",
        headers: { cookie },
        body: form,
      }),
    (res) => res.json() as Promise<GenResponse>,
  );

  if (data.error) throw new RockyError(data.error);
  const variant = data.variants?.[0];
  if (!variant || !variant.image) {
    throw new RockyError(variant?.error ?? "Rocky n'a produit aucune image.");
  }
  return { dataUrl: variant.image, assetId: variant.assetId };
}

/** Décode un data URL en buffer + extension de fichier. */
export function decodeDataUrl(dataUrl: string): { buffer: Buffer; ext: string } {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
  if (!m) throw new RockyError("Réponse Rocky illisible (data URL invalide).");
  const ext = m[1] === "image/jpeg" ? "jpg" : m[1] === "image/webp" ? "webp" : "png";
  return { buffer: Buffer.from(m[2], "base64"), ext };
}
