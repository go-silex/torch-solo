import { EventEmitter } from "node:events";
import { promises as fs } from "node:fs";
import path from "node:path";
import chokidar, { type FSWatcher } from "chokidar";
import {
  getObsidianVaultName,
  getOperatorName,
  getTorchZone,
  getVaultRoot,
} from "@/lib/config";
import {
  ContentFrontmatterSchema,
  IMMUTABLE_KEYS,
  type ContentFilter,
  type ContentFrontmatter,
  type ContentPatch,
} from "@/lib/types/content";
import {
  parseContentFile,
  serializeContentFile,
} from "@/lib/vault/frontmatter";
import { canonicalDir, generateId } from "@/lib/vault/naming";
import { publishedDateFromUrls } from "@/lib/published-date";

/**
 * Store vault : le vault Obsidian est LA base de données.
 * Cache mémoire jetable (reconstruit au boot, réparé par le watcher).
 *
 * Règles d'écriture (latence Drive ~1-6 min, multi-écrivain) :
 * - toujours relire le fichier FRAIS avant d'écrire (jamais depuis le cache) ;
 * - merge au niveau champ : seules les clés patchées sont écrasées ;
 * - le corps n'est écrasé que si le patch le contient, gardé par mtime (409) ;
 * - écriture atomique : .tmp + rename ;
 * - les écritures propres sont ignorées par le watcher (selfWrites).
 */

export type CacheEntry = {
  fm: ContentFrontmatter;
  body: string;
  absPath: string;
  mtimeMs: number;
  /** Timestamp de la dernière modification DU CORPS (≠ patchs de champs). */
  bodyMtimeMs: number;
};

export type QuarantineEntry = {
  absPath: string;
  relPath: string;
  error: string;
};

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export type CreateContentInput = {
  title: string;
  format: ContentFrontmatter["format"];
  emitter: ContentFrontmatter["emitter"];
  /** Facultatif : plus demandé à la création depuis le 2026-09-22. */
  sel?: ContentFrontmatter["sel"];
  pillar?: ContentFrontmatter["pillar"];
  category?: ContentFrontmatter["category"];
  goals?: ContentFrontmatter["goals"];
  platforms?: ContentFrontmatter["platforms"];
  status?: ContentFrontmatter["status"];
  planned?: string | null;
  "derived-from"?: string | null;
  recycles?: string | null;
  body?: string;
  tags?: string[];
};

/** Signature d'écriture : qui, quand (à la seconde, en heure locale ISO). */
function signature() {
  return {
    "updated-by": getOperatorName(),
    "updated-at": new Date().toISOString().slice(0, 19),
  };
}

const SELF_WRITE_WINDOW_MS = 2000;

class VaultStore extends EventEmitter {
  private entries = new Map<string, CacheEntry>();
  private quarantine = new Map<string, QuarantineEntry>();
  private selfWrites = new Map<string, number>();
  /**
   * Dernières versions écrites par CE processus, par id (contenu complet).
   * Google Drive (File Provider) peut servir des lectures périmées plusieurs
   * secondes après un write/rename — mtime compris. La seule détection fiable
   * d'un écho de nos propres écritures est par CONTENU : si une relecture
   * correspond à une version récente que nous avons écrite, ce n'est pas une
   * modif externe.
   */
  private recentWrites = new Map<string, string[]>();

  private rememberWrite(id: string, content: string) {
    const list = this.recentWrites.get(id) ?? [];
    list.push(content);
    if (list.length > 8) list.shift();
    this.recentWrites.set(id, list);
  }

  private isOwnWrite(id: string, content: string): boolean {
    return (this.recentWrites.get(id) ?? []).includes(content);
  }
  private watcher: FSWatcher | null = null;
  private ready: Promise<void>;
  readonly contentDir: string;

  constructor() {
    super();
    this.setMaxListeners(50);
    this.contentDir = getTorchZone().contentDir;
    this.ready = this.init();
  }

  private async init() {
    await fs.mkdir(this.contentDir, { recursive: true });
    await this.scanAll();
    this.startWatcher(process.env.TORCH_USE_POLLING === "1");
  }

  async whenReady() {
    await this.ready;
  }

  /* ---------- lecture ---------- */

  private async scanAll() {
    const files = await this.walk(this.contentDir);
    await Promise.all(files.map((f) => this.loadFile(f, { silent: true })));
  }

  private async walk(dir: string): Promise<string[]> {
    const out: string[] = [];
    let items: string[] = [];
    try {
      items = await fs.readdir(dir);
    } catch {
      return out;
    }
    for (const item of items) {
      if (item.startsWith(".")) continue;
      const abs = path.join(dir, item);
      const stat = await fs.stat(abs).catch(() => null);
      if (!stat) continue;
      if (stat.isDirectory()) out.push(...(await this.walk(abs)));
      else if (item.endsWith(".md")) out.push(abs);
    }
    return out;
  }

  private idFromPath(absPath: string): string {
    return path.basename(absPath, ".md");
  }

  private async loadFile(absPath: string, opts?: { silent?: boolean }) {
    const id = this.idFromPath(absPath);
    let raw: string;
    let mtimeMs: number;
    try {
      raw = await fs.readFile(absPath, "utf8");
      mtimeMs = (await fs.stat(absPath)).mtimeMs;
    } catch {
      // Fichier disparu : purge.
      void this.dropByPath(absPath, opts);
      return;
    }

    // Écho de nos propres écritures (éventuellement périmé — Drive FS) :
    // le cache est déjà au moins aussi frais, ne pas régresser.
    const existing = this.entries.get(id);
    if (existing && existing.absPath === absPath && this.isOwnWrite(id, raw)) {
      return;
    }

    const parsed = parseContentFile(raw);
    if ("error" in parsed) {
      this.entries.delete(id);
      this.quarantine.set(absPath, {
        absPath,
        relPath: path.relative(this.contentDir, absPath),
        error: parsed.error,
      });
      if (!opts?.silent) this.emit("change", { type: "quarantine", id });
      return;
    }

    this.quarantine.delete(absPath);
    // L'id canonique est le nom de fichier ; on force la cohérence en mémoire.
    const fm = { ...parsed.fm, id };
    if (process.env.TORCH_DEBUG === "1") {
      console.log(
        `[torch:loadFile] ${id} status=${fm.status} planned=${fm.planned} pillar=${fm.pillar} silent=${!!opts?.silent}`,
      );
    }
    const bodyMtimeMs =
      existing && existing.body === parsed.body ? existing.bodyMtimeMs : mtimeMs;
    this.entries.set(id, { fm, body: parsed.body, absPath, mtimeMs, bodyMtimeMs });
    if (!opts?.silent) this.emit("change", { type: "content-changed", id });
  }

  private async dropByPath(absPath: string, opts?: { silent?: boolean }) {
    // Drive peut émettre des unlink fantômes pendant la sync : ne purger que
    // si le fichier a réellement disparu.
    const stillThere = await fs.access(absPath).then(
      () => true,
      () => false,
    );
    if (stillThere) {
      void this.loadFile(absPath, opts);
      return;
    }
    const id = this.idFromPath(absPath);
    const existing = this.entries.get(id);
    // Ne purger que si l'entrée pointe bien vers ce chemin (un move émet unlink+add).
    if (existing && existing.absPath === absPath) {
      this.entries.delete(id);
      if (!opts?.silent) this.emit("change", { type: "content-removed", id });
    }
    this.quarantine.delete(absPath);
  }

  listContents(filter?: ContentFilter): CacheEntry[] {
    let list = [...this.entries.values()];
    if (filter) {
      const f = filter;
      list = list.filter((e) => {
        if (f.status && !f.status.includes(e.fm.status)) return false;
        if (f.format && !f.format.includes(e.fm.format)) return false;
        if (f.pillar && !f.pillar.includes(e.fm.pillar)) return false;
        if (f.category && !(e.fm.category && f.category.includes(e.fm.category)))
          return false;
        if (f.goal && !e.fm.goals.some((g) => f.goal!.includes(g))) return false;
        if (f.sel && !(e.fm.sel && f.sel.includes(e.fm.sel))) return false;
        if (f.emitter && !f.emitter.includes(e.fm.emitter)) return false;
        if (f.platform && !e.fm.platforms.some((p) => f.platform!.includes(p)))
          return false;
        if (f.derivedFrom && e.fm["derived-from"] !== f.derivedFrom) return false;
        if (f.search) {
          const q = f.search.toLowerCase();
          if (
            !e.fm.title.toLowerCase().includes(q) &&
            !e.fm.id.toLowerCase().includes(q) &&
            !e.fm.tags.some((t) => t.toLowerCase().includes(q))
          )
            return false;
        }
        return true;
      });
    }
    return list.sort((a, b) => b.fm.created.localeCompare(a.fm.created));
  }

  /** Lien qui ouvre la note dans Obsidian (chemin relatif au vault, sans .md). */
  obsidianUrl(entry: CacheEntry): string {
    const rel = path
      .relative(getVaultRoot(), entry.absPath)
      .replace(/\.md$/, "")
      .split(path.sep)
      .join("/");
    return `obsidian://open?vault=${encodeURIComponent(getObsidianVaultName())}&file=${encodeURIComponent(rel)}`;
  }

  getContent(id: string): CacheEntry | null {
    return this.entries.get(id) ?? null;
  }

  listQuarantine(): QuarantineEntry[] {
    return [...this.quarantine.values()];
  }

  /* ---------- écriture ---------- */

  private markSelfWrite(absPath: string) {
    this.selfWrites.set(absPath, Date.now());
  }

  private isSelfWrite(absPath: string): boolean {
    const t = this.selfWrites.get(absPath);
    if (!t) return false;
    if (Date.now() - t > SELF_WRITE_WINDOW_MS) {
      this.selfWrites.delete(absPath);
      return false;
    }
    return true;
  }

  private async atomicWrite(absPath: string, content: string) {
    const tmp = path.join(
      path.dirname(absPath),
      `.${path.basename(absPath)}.tmp`,
    );
    this.markSelfWrite(absPath);
    this.markSelfWrite(tmp);
    await fs.writeFile(tmp, content, "utf8");
    await fs.rename(tmp, absPath);
  }

  async createContent(input: CreateContentInput): Promise<CacheEntry> {
    await this.whenReady();
    const created = new Date().toISOString().slice(0, 10);
    const dir = canonicalDir(this.contentDir, input.emitter, input.format);
    await fs.mkdir(dir, { recursive: true });
    const id = generateId(dir, created, input.title, (candidate) =>
      this.entries.has(candidate),
    );

    const fm = ContentFrontmatterSchema.parse({
      type: "torch-content",
      schema: 1,
      id,
      title: input.title,
      format: input.format,
      platforms: input.platforms ?? [],
      pillar: input.pillar ?? "none",
      category: input.category ?? null,
      goals: input.goals ?? [],
      ...(input.sel ? { sel: input.sel } : {}),
      emitter: input.emitter,
      status: input.status ?? "idea",
      created,
      planned: input.planned ?? null,
      "derived-from": input["derived-from"] ?? null,
      recycles: input.recycles ?? null,
      tags: input.tags ?? [],
      ...signature(),
    });

    const body = input.body ?? "\n## Hook\n\n\n## Notes\n\n";
    const absPath = path.join(dir, `${id}.md`);
    const content = serializeContentFile(fm, body);
    await this.atomicWrite(absPath, content);
    this.rememberWrite(id, content);
    const mtimeMs = (await fs.stat(absPath)).mtimeMs;
    const entry: CacheEntry = { fm, body, absPath, mtimeMs, bodyMtimeMs: mtimeMs };
    this.entries.set(id, entry);
    this.emit("change", { type: "content-changed", id });
    return entry;
  }

  /** Sérialise les écritures par fiche (deux PATCH rapprochés ne s'entrelacent pas). */
  private writeQueues = new Map<string, Promise<unknown>>();

  private enqueue<T>(id: string, task: () => Promise<T>): Promise<T> {
    const prev = this.writeQueues.get(id) ?? Promise.resolve();
    const next = prev.then(task, task);
    this.writeQueues.set(id, next.catch(() => undefined));
    return next;
  }

  async patchContent(
    id: string,
    patch: { fm?: ContentPatch; body?: string; ifBodyUnmodifiedSince?: number },
  ): Promise<CacheEntry> {
    await this.whenReady();
    return this.enqueue(id, () => this.patchContentInner(id, patch));
  }

  private async patchContentInner(
    id: string,
    patch: { fm?: ContentPatch; body?: string; ifBodyUnmodifiedSince?: number },
  ): Promise<CacheEntry> {
    const cached = this.entries.get(id);
    if (!cached) throw new Error(`Fiche introuvable : ${id}`);

    // 1. Relecture fraîche depuis le disque — SAUF si le disque nous sert un
    // écho (éventuellement périmé) de nos propres écritures : Google Drive
    // File Provider peut renvoyer une version antérieure (contenu ET mtime)
    // pendant plusieurs secondes après un write/rename. Détection par CONTENU.
    const raw = await fs.readFile(cached.absPath, "utf8");
    const stat = await fs.stat(cached.absPath);
    const diskIsOwnEcho = this.isOwnWrite(id, raw);

    let parsed: { fm: ContentFrontmatter; body: string };
    if (diskIsOwnEcho) {
      // Base = cache (la version la plus fraîche écrite par ce processus).
      parsed = { fm: cached.fm, body: cached.body };
    } else {
      const fromDisk = parseContentFile(raw);
      if ("error" in fromDisk) {
        throw new Error(
          `Fichier invalide sur disque (${fromDisk.error}) — corrige-le dans Obsidian avant de le modifier ici.`,
        );
      }
      parsed = fromDisk;
    }

    if (process.env.TORCH_DEBUG === "1") {
      console.log(
        `[torch:patch] ${id} echo=${diskIsOwnEcho} base(status=${parsed.fm.status} planned=${parsed.fm.planned} pillar=${parsed.fm.pillar}) cache(status=${cached.fm.status} planned=${cached.fm.planned} pillar=${cached.fm.pillar}) patch=${JSON.stringify(patch.fm)}`,
      );
    }

    // 2. Garde sur le corps : si l'UI éditait un corps périmé → 409.
    // (comparaison par contenu — le mtime n'est pas fiable sur Drive)
    if (patch.body !== undefined && patch.body !== parsed.body) {
      const externalBodyChange = !diskIsOwnEcho && parsed.body !== cached.body;
      const cacheNewerThanClient =
        patch.ifBodyUnmodifiedSince !== undefined &&
        cached.bodyMtimeMs > patch.ifBodyUnmodifiedSince + 1;
      if (externalBodyChange || cacheNewerThanClient) {
        throw new ConflictError(
          "Le corps de la note a été modifié ailleurs (Obsidian ou autre machine). Recharge la fiche.",
        );
      }
    }
    void stat;

    // 3. Merge au niveau champ sur la version FRAÎCHE.
    const freshFm = { ...parsed.fm, id } as Record<string, unknown>;
    if (patch.fm) {
      for (const [key, value] of Object.entries(patch.fm)) {
        if ((IMMUTABLE_KEYS as readonly string[]).includes(key)) continue;
        if (value === undefined) continue;
        freshFm[key] = value;
      }
    }

    Object.assign(freshFm, signature());

    // Règles métier légères sur les transitions.
    const nextFm = ContentFrontmatterSchema.parse(freshFm);
    // Passage en publié sans date : la date réelle du post si l'URL la donne
    // (LinkedIn), sinon aujourd'hui. Jamais « aujourd'hui » pour un post
    // publié il y a des semaines et rangé après coup.
    if (nextFm.status === "published" && !nextFm["published-at"]) {
      nextFm["published-at"] =
        publishedDateFromUrls(nextFm["published-urls"]) ??
        new Date().toISOString().slice(0, 10);
    }

    const nextBody = patch.body !== undefined ? patch.body : parsed.body;

    // 4. Déplacement si emitter/format patché ET changé.
    let targetPath = cached.absPath;
    const emitterChanged =
      patch.fm?.emitter !== undefined && patch.fm.emitter !== parsed.fm.emitter;
    const formatChanged =
      patch.fm?.format !== undefined && patch.fm.format !== parsed.fm.format;
    if (emitterChanged || formatChanged) {
      const dir = canonicalDir(this.contentDir, nextFm.emitter, nextFm.format);
      await fs.mkdir(dir, { recursive: true });
      targetPath = path.join(dir, `${id}.md`);
    }

    const content = serializeContentFile(nextFm, nextBody);
    await this.atomicWrite(cached.absPath, content);
    this.rememberWrite(id, content);
    if (targetPath !== cached.absPath) {
      this.markSelfWrite(targetPath);
      await fs.rename(cached.absPath, targetPath);
    }

    const mtimeMs = (await fs.stat(targetPath)).mtimeMs;
    const entry: CacheEntry = {
      fm: nextFm,
      body: nextBody,
      absPath: targetPath,
      mtimeMs,
      bodyMtimeMs: nextBody === cached.body ? cached.bodyMtimeMs : mtimeMs,
    };
    this.entries.set(id, entry);
    this.emit("change", { type: "content-changed", id });
    return entry;
  }

  /**
   * Copie d'une fiche : même classement, corps repris, statut idée, sans date ni
   * liens de publication. `recycles` pointe l'original si celui-ci est publié
   * (boucle de recyclage des posts gagnants).
   */
  async duplicateContent(id: string): Promise<CacheEntry> {
    await this.whenReady();
    const source = this.entries.get(id);
    if (!source) throw new Error(`Fiche introuvable : ${id}`);
    const fm = source.fm;
    return this.createContent({
      title: `${fm.title} (copie)`,
      format: fm.format,
      emitter: fm.emitter,
      ...(fm.sel ? { sel: fm.sel } : {}),
      pillar: fm.pillar,
      category: fm.category,
      goals: fm.goals,
      platforms: fm.platforms,
      "derived-from": fm["derived-from"],
      recycles: fm.status === "published" ? id : fm.recycles,
      tags: fm.tags,
      body: source.body,
    });
  }

  /** Suppression douce : déplace la note vers <zone>/_Trash/ (récupérable). */
  async deleteContent(id: string): Promise<void> {
    await this.whenReady();
    return this.enqueue(id, async () => {
      const cached = this.entries.get(id);
      if (!cached) throw new Error(`Fiche introuvable : ${id}`);
      const trashDir = path.join(path.dirname(this.contentDir), "_Trash");
      await fs.mkdir(trashDir, { recursive: true });
      let target = path.join(trashDir, `${id}.md`);
      if (
        await fs.access(target).then(
          () => true,
          () => false,
        )
      ) {
        target = path.join(trashDir, `${id}_${Date.now()}.md`);
      }
      this.markSelfWrite(cached.absPath);
      this.markSelfWrite(target);
      await fs.rename(cached.absPath, target);
      this.entries.delete(id);
      this.recentWrites.delete(id);
      this.emit("change", { type: "content-removed", id });
    });
  }

  /* ---------- watcher ---------- */

  private startWatcher(usePolling = false) {
    if (this.watcher || process.env.TORCH_NO_WATCH === "1") return;
    this.watcher = chokidar.watch(this.contentDir, {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 1500, pollInterval: 300 },
      ignored: (p) => path.basename(p).startsWith("."),
      usePolling,
      interval: usePolling ? 2000 : undefined,
    });
    this.watcher.on("error", (err) => {
      const code = (err as NodeJS.ErrnoException)?.code;
      // FSEvents refusé (TCC macOS sur Google Drive quand lancé hors Terminal)
      // → bascule en polling, qui ne demande que des lectures.
      if (!usePolling && (code === "EPERM" || code === "EACCES")) {
        console.warn("[torch] watcher FSEvents refusé — bascule en polling (2 s)");
        void this.watcher?.close();
        this.watcher = null;
        this.startWatcher(true);
      }
    });
    const onFile = (absPath: string) => {
      if (!absPath.endsWith(".md")) return;
      if (this.isSelfWrite(absPath)) return;
      void this.loadFile(absPath);
    };
    this.watcher.on("add", onFile);
    this.watcher.on("change", onFile);
    this.watcher.on("unlink", (absPath: string) => {
      if (!absPath.endsWith(".md")) return;
      if (this.isSelfWrite(absPath)) return;
      void this.dropByPath(absPath);
    });
  }

  async close() {
    await this.watcher?.close();
    this.watcher = null;
    this.removeAllListeners();
  }
}

/* Singleton survivant au HMR de Next dev. */
const globalStore = globalThis as unknown as { __torchStore?: VaultStore };

export async function getStore(): Promise<VaultStore> {
  if (!globalStore.__torchStore) {
    globalStore.__torchStore = new VaultStore();
  }
  await globalStore.__torchStore.whenReady();
  return globalStore.__torchStore;
}

/** Tests uniquement. */
export async function resetStore() {
  await globalStore.__torchStore?.close();
  globalStore.__torchStore = undefined;
}
