import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetConfigCache } from "@/lib/config";
import { ConflictError, getStore, resetStore } from "@/lib/vault/store";
import { parseContentFile, serializeContentFile } from "@/lib/vault/frontmatter";
import { ContentFrontmatterSchema } from "@/lib/types/content";

let vaultRoot: string;

beforeEach(async () => {
  vaultRoot = await fs.mkdtemp(path.join(tmpdir(), "torch-test-"));
  process.env.TORCH_VAULT_ROOT = vaultRoot;
  process.env.TORCH_NO_WATCH = "1";
  resetConfigCache();
  await resetStore();
});

afterEach(async () => {
  await resetStore();
  delete process.env.TORCH_VAULT_ROOT;
  delete process.env.TORCH_NO_WATCH;
  resetConfigCache();
  await fs.rm(vaultRoot, { recursive: true, force: true });
});

const baseInput = {
  title: "Mon premier short",
  format: "short",
  emitter: "caroline",
  sel: "educate",
} as const;

describe("createContent", () => {
  it("crée le fichier dans le dossier Émetteur/Format avec un id daté", async () => {
    const store = await getStore();
    const entry = await store.createContent(baseInput);
    expect(entry.absPath).toContain(path.join("Content", "Caroline", "Shorts"));
    expect(entry.fm.id).toMatch(/^\d{4}-\d{2}-\d{2}_Mon_Premier_Short$/);
    const onDisk = await fs.readFile(entry.absPath, "utf8");
    const parsed = parseContentFile(onDisk);
    expect("fm" in parsed).toBe(true);
  });

  it("gère les collisions de nom avec un suffixe", async () => {
    const store = await getStore();
    const a = await store.createContent(baseInput);
    const b = await store.createContent(baseInput);
    expect(b.fm.id).toBe(`${a.fm.id}_2`);
  });

  it("ne réutilise pas un id déjà pris dans un autre dossier", async () => {
    const store = await getStore();
    const arman = await store.createContent(baseInput);
    const pierre = await store.createContent({ ...baseInput, emitter: "ryse", format: "post" });
    expect(pierre.fm.id).toBe(`${arman.fm.id}_2`);
    expect(store.listContents()).toHaveLength(2);
  });

  it("translittère les accents du titre", async () => {
    const store = await getStore();
    const entry = await store.createContent({
      ...baseInput,
      title: "Générer des vidéos éclairées",
    });
    expect(entry.fm.id).toContain("Generer_Des_Videos_Eclairees");
    expect(entry.fm.title).toBe("Générer des vidéos éclairées");
  });
});

describe("patchContent", () => {
  it("patche un champ sans toucher le corps", async () => {
    const store = await getStore();
    const created = await store.createContent({ ...baseInput, body: "\nCORPS UNIQUE\n" });
    const patched = await store.patchContent(created.fm.id, {
      fm: { status: "draft" },
    });
    expect(patched.fm.status).toBe("draft");
    expect(patched.body).toBe("\nCORPS UNIQUE\n");
    const onDisk = await fs.readFile(patched.absPath, "utf8");
    expect(onDisk).toContain("CORPS UNIQUE");
    expect(onDisk).toContain("status: draft");
  });

  it("merge au niveau champ : une modif externe non patchée survit", async () => {
    const store = await getStore();
    const created = await store.createContent(baseInput);
    // Modif externe (Obsidian) : editor + corps, directement sur le disque.
    const raw = await fs.readFile(created.absPath, "utf8");
    const parsed = parseContentFile(raw);
    if (!("fm" in parsed)) throw new Error("parse failed");
    const externalFm = ContentFrontmatterSchema.parse({
      ...parsed.fm,
      editor: "mounir",
    });
    await fs.writeFile(
      created.absPath,
      serializeContentFile(externalFm, "\nCORPS EXTERNE\n"),
      "utf8",
    );
    // Patch Torch (cache encore ancien) : status seulement.
    const patched = await store.patchContent(created.fm.id, {
      fm: { status: "ready" },
    });
    expect(patched.fm.status).toBe("ready");
    expect(patched.fm.editor).toBe("mounir"); // modif externe préservée
    expect(patched.body).toBe("\nCORPS EXTERNE\n"); // corps externe préservé
  });

  it("409 si patch de corps sur une version périmée", async () => {
    const store = await getStore();
    const created = await store.createContent({ ...baseInput, body: "\nv1\n" });
    const staleMtime = created.mtimeMs;
    await new Promise((r) => setTimeout(r, 20));
    await fs.writeFile(
      created.absPath,
      serializeContentFile(created.fm, "\nv2 externe\n"),
      "utf8",
    );
    await expect(
      store.patchContent(created.fm.id, {
        body: "\nv2 concurrent\n",
        ifBodyUnmodifiedSince: staleMtime,
      }),
    ).rejects.toThrow(ConflictError);
  });

  it("interdit de patcher les clés immuables", async () => {
    const store = await getStore();
    const created = await store.createContent(baseInput);
    const patched = await store.patchContent(created.fm.id, {
      fm: { id: "autre-id", created: "1999-01-01", status: "draft" } as never,
    });
    expect(patched.fm.id).toBe(created.fm.id);
    expect(patched.fm.created).toBe(created.fm.created);
  });

  it("pose published-at automatiquement au passage à published", async () => {
    const store = await getStore();
    const created = await store.createContent(baseInput);
    const patched = await store.patchContent(created.fm.id, {
      fm: { status: "published" },
    });
    expect(patched.fm["published-at"]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("déplace le fichier quand l'émetteur change", async () => {
    const store = await getStore();
    const created = await store.createContent(baseInput);
    const patched = await store.patchContent(created.fm.id, {
      fm: { emitter: "ryse" },
    });
    expect(patched.absPath).toContain(path.join("Content", "Ryse", "Shorts"));
    await expect(fs.access(created.absPath)).rejects.toThrow();
    await expect(fs.access(patched.absPath)).resolves.toBeUndefined();
  });

  it("ne déplace PAS un fichier rangé à la main si emitter/format inchangés", async () => {
    const store = await getStore();
    const created = await store.createContent(baseInput);
    const customDir = path.join(vaultRoot, "Torch", "Content", "Custom");
    await fs.mkdir(customDir, { recursive: true });
    const newPath = path.join(customDir, path.basename(created.absPath));
    await fs.rename(created.absPath, newPath);
    await resetStore(); // re-scan (watcher désactivé en test)
    const store2 = await getStore();
    const patched = await store2.patchContent(created.fm.id, {
      fm: { status: "draft" },
    });
    expect(patched.absPath).toBe(newPath);
  });
});

describe("ContentPatchSchema", () => {
  it("ne contient que les clés fournies (aucun défaut ré-injecté)", async () => {
    const { ContentPatchSchema } = await import("@/lib/types/content");
    const parsed = ContentPatchSchema.parse({ pillar: "le-chantier" });
    expect(Object.keys(parsed)).toEqual(["pillar"]);
  });
});

describe("robustesse Drive (lectures périmées)", () => {
  it("deux PATCH rapprochés ne se perdent pas", async () => {
    const store = await getStore();
    const created = await store.createContent(baseInput);
    await Promise.all([
      store.patchContent(created.fm.id, { fm: { status: "draft" } }),
      store.patchContent(created.fm.id, { fm: { editor: "testeur" } }),
    ]);
    const raw = await fs.readFile(store.getContent(created.fm.id)!.absPath, "utf8");
    expect(raw).toContain("status: draft");
    expect(raw).toContain("editor: testeur");
  });

  it("un disque servant une version périmée n'écrase pas la dernière écriture", async () => {
    const store = await getStore();
    const created = await store.createContent(baseInput);
    const v0 = await fs.readFile(created.absPath, "utf8");
    const patched = await store.patchContent(created.fm.id, {
      fm: { status: "draft" },
    });
    // Simule Google Drive : le fichier revient à v0 avec un mtime ANCIEN.
    await fs.writeFile(created.absPath, v0, "utf8");
    const old = new Date(patched.mtimeMs - 60_000);
    await fs.utimes(created.absPath, old, old);
    // Le patch suivant doit partir du cache (v1), pas du disque périmé (v0).
    const result = await store.patchContent(created.fm.id, {
      fm: { editor: "testeur" },
    });
    expect(result.fm.status).toBe("draft");
    expect(result.fm.editor).toBe("testeur");
  });
});

describe("scan & quarantaine", () => {
  it("met en quarantaine un fichier invalide sans l'écraser", async () => {
    const store = await getStore();
    const dir = path.join(vaultRoot, "Torch", "Content");
    const bad = path.join(dir, "2026-01-01_Casse.md");
    await fs.writeFile(bad, "---\ntype: torch-content\nformat: [broken\n---\nx", "utf8");
    await resetStore();
    const store2 = await getStore();
    expect(store2.getContent("2026-01-01_Casse")).toBeNull();
    expect(store2.listQuarantine()).toHaveLength(1);
    const untouched = await fs.readFile(bad, "utf8");
    expect(untouched).toContain("[broken");
    void store;
  });

  it("ignore les .md étrangers (sans type torch-content)", async () => {
    const dir = path.join(vaultRoot, "Torch", "Content");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, "Random_Note.md"), "---\ntype: note\n---\nx", "utf8");
    await resetStore();
    const store = await getStore();
    expect(store.getContent("Random_Note")).toBeNull();
    // Étranger = quarantaine (visible mais jamais réécrit)
    expect(store.listQuarantine()).toHaveLength(1);
  });
});

describe("listContents", () => {
  it("filtre par statut, émetteur et recherche", async () => {
    const store = await getStore();
    await store.createContent({ ...baseInput, title: "Alpha" });
    const b = await store.createContent({
      ...baseInput,
      emitter: "ryse",
      title: "Beta special",
    });
    await store.patchContent(b.fm.id, { fm: { status: "draft" } });

    expect(store.listContents({ emitter: ["ryse"] })).toHaveLength(1);
    expect(store.listContents({ status: ["draft"] })).toHaveLength(1);
    expect(store.listContents({ search: "special" })).toHaveLength(1);
    expect(store.listContents()).toHaveLength(2);
  });
});
