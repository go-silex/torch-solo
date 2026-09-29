import { getSetting } from "@/lib/config";

/**
 * Client Flame (review vidéo — flame.gosilex.com).
 * Auth machine : header x-api-key (FLAME_API_KEY dans ~/.config/torch/torch.env),
 * nécessite la PR silex-flame#2 déployée (FLAME_MACHINE_API_KEY côté serveur).
 */

export type FlameProject = { id: string; name: string; slug: string };
export type FlameFolder = {
  id: string;
  projectId: string;
  name: string;
  parentId?: string | null;
};
export type FlameShareLink = { id: string; token: string; url?: string };
export type FlameAsset = {
  id: string;
  title: string;
  status: string;
  reviewStatus: "none" | "in_review" | "approved" | "changes_requested";
  createdAt: string | number;
};

export class FlameError extends Error {}

function baseUrl(): string {
  return (getSetting("FLAME_BASE_URL") ?? "https://flame.gosilex.com").replace(/\/$/, "");
}

export function flameConfigured(): boolean {
  return Boolean(getSetting("FLAME_API_KEY"));
}

async function flameFetch<T>(
  path: string,
  init?: RequestInit & { fetchImpl?: typeof fetch },
): Promise<T> {
  const key = getSetting("FLAME_API_KEY");
  if (!key) {
    throw new FlameError(
      "FLAME_API_KEY absent de ~/.config/torch/torch.env — intégration Flame non configurée.",
    );
  }
  const doFetch = init?.fetchImpl ?? fetch;
  const res = await doFetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      "x-api-key": key,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new FlameError(`Flame ${res.status} sur ${path} : ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

/** Trouve ou crée le projet conteneur (par défaut « Torch »). Idempotent. */
export async function ensureProject(name = "Torch"): Promise<FlameProject> {
  const projects = await flameFetch<FlameProject[]>("/api/projects");
  const found = projects.find((p) => p.name === name);
  if (found) return found;
  return flameFetch<FlameProject>("/api/projects", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function createFolder(
  projectId: string,
  name: string,
  parentId?: string | null,
): Promise<FlameFolder> {
  return flameFetch<FlameFolder>("/api/folders", {
    method: "POST",
    body: JSON.stringify({ projectId, name, parentId: parentId ?? undefined }),
  });
}

/**
 * Trouve ou crée un dossier à un niveau donné (parentId null = racine du projet).
 * Idempotent : sans ça, chaque fiche recréerait un dossier « Shorts » de plus.
 * Si le Flame déployé n'expose pas encore GET /api/folders, on retombe sur une
 * création simple — l'app reste utilisable, le rangement se met en place au
 * prochain déploiement.
 */
export async function ensureFolder(
  projectId: string,
  name: string,
  parentId: string | null = null,
): Promise<FlameFolder> {
  try {
    const params = new URLSearchParams({ projectId });
    const folders = await flameFetch<FlameFolder[]>(`/api/folders?${params}`);
    const found = folders.find(
      (f) => f.name === name && (f.parentId ?? null) === parentId,
    );
    if (found) return found;
  } catch (err) {
    if (!(err instanceof FlameError)) throw err;
    // GET absent (404/405) : on crée sans dédoublonner.
  }
  return createFolder(projectId, name, parentId);
}

/** URL de la page du dossier dans Flame — c'est là qu'on téléverse (compte requis). */
export function folderUrl(projectId: string, folderId: string): string {
  return `${baseUrl()}/projects/${projectId}?folder=${folderId}`;
}

export async function createShareLink(
  folderId: string,
  name: string,
): Promise<FlameShareLink> {
  const link = await flameFetch<FlameShareLink>("/api/share-links", {
    method: "POST",
    body: JSON.stringify({ folderId, name }),
  });
  // L'API peut renvoyer une URL relative (NEXT_PUBLIC_APP_URL figé à vide au
  // build Docker) : on normalise toujours en absolu.
  const url =
    link.url && link.url.startsWith("http")
      ? link.url
      : `${baseUrl()}${link.url?.startsWith("/") ? link.url : `/share/${link.token}`}`;
  return { ...link, url };
}

export async function listAssets(
  projectId: string,
  folderId: string,
): Promise<FlameAsset[]> {
  const params = new URLSearchParams({ projectId, folderId });
  return flameFetch<FlameAsset[]>(`/api/assets?${params}`);
}

/** Mapping reviewStatus Flame → edit-status Torch. */
export function mapReviewStatus(
  reviewStatus: FlameAsset["reviewStatus"],
): "editing" | "in-review" | "changes-requested" | "approved" {
  switch (reviewStatus) {
    case "in_review":
      return "in-review";
    case "changes_requested":
      return "changes-requested";
    case "approved":
      return "approved";
    default:
      return "editing";
  }
}
