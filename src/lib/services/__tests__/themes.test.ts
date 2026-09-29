import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetConfigCache } from "@/lib/config";
import {
  ThemeNotFoundError,
  ThemeOverlapError,
  createTheme,
  deleteTheme,
  listThemes,
  updateTheme,
} from "@/lib/services/themes";

let vaultRoot: string;
let file: string;

beforeEach(async () => {
  vaultRoot = await fs.mkdtemp(path.join(tmpdir(), "torch-themes-"));
  process.env.TORCH_VAULT_ROOT = vaultRoot;
  resetConfigCache();
  file = path.join(vaultRoot, "Torch", "_Config", "Themes.md");
});

afterEach(async () => {
  delete process.env.TORCH_VAULT_ROOT;
  resetConfigCache();
  await fs.rm(vaultRoot, { recursive: true, force: true });
});

const week = { start: "2026-09-21", end: "2026-09-27", label: "Recrutement cohorte 1" };

describe("createTheme", () => {
  it("crée _Config/Themes.md et relit ce qu'il a écrit", async () => {
    const theme = await createTheme(week);
    expect(theme.id).toMatch(/^2026-09-21-[a-z0-9]{4}$/);
    expect(await listThemes()).toEqual([theme]);
    expect(await fs.readFile(file, "utf8")).toContain("type: torch-config");
  });

  it("écrit hors du dossier Content", async () => {
    await createTheme(week);
    await expect(
      fs.stat(path.join(vaultRoot, "Torch", "Content")),
    ).rejects.toThrow();
  });

  it("garde un label à deux-points relisible", async () => {
    await createTheme({ ...week, label: "Thème : la semaine, version 2" });
    expect((await listThemes())[0].label).toBe("Thème : la semaine, version 2");
  });

  it("ne perd aucun thème quand deux créations partent en même temps", async () => {
    await Promise.all([
      createTheme(week),
      createTheme({ start: "2026-09-28", end: "2026-10-04", label: "Lancement" }),
    ]);
    expect(await listThemes()).toHaveLength(2);
  });

  it("trie par date de début", async () => {
    await createTheme({ start: "2026-10-05", end: "2026-10-11", label: "Octobre" });
    await createTheme(week);
    expect((await listThemes()).map((t) => t.label)).toEqual([
      "Recrutement cohorte 1",
      "Octobre",
    ]);
  });
});

describe("updateTheme / deleteTheme", () => {
  it("modifie le nom et les bornes", async () => {
    const { id } = await createTheme(week);
    const updated = await updateTheme(id, {
      start: "2026-09-23",
      end: "2026-09-25",
      label: "Trois jours",
    });
    expect(updated).toMatchObject({ id, start: "2026-09-23", label: "Trois jours" });
    expect(await listThemes()).toEqual([updated]);
  });

  it("supprime sans toucher aux autres", async () => {
    const a = await createTheme(week);
    const b = await createTheme({ start: "2026-09-28", end: "2026-10-04", label: "Lancement" });
    await deleteTheme(a.id);
    expect(await listThemes()).toEqual([b]);
  });

  it("404 sur un id inconnu", async () => {
    await expect(updateTheme("inconnu", week)).rejects.toBeInstanceOf(ThemeNotFoundError);
    await expect(deleteTheme("inconnu")).rejects.toBeInstanceOf(ThemeNotFoundError);
  });
});

describe("fichier édité à la main", () => {
  async function write(content: string) {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, content, "utf8");
  }

  it("ignore une entrée invalide et garde les bonnes", async () => {
    await write(
      [
        "---",
        "type: torch-config",
        "themes:",
        "  - id: ok-1",
        "    start: 2026-09-21",
        "    end: 2026-09-27",
        '    label: "Bonne entrée"',
        "  - id: cassee",
        "    start: pas-une-date",
        "    end: 2026-09-27",
        '    label: "Mauvaise"',
        "---",
        "",
      ].join("\n"),
    );
    expect((await listThemes()).map((t) => t.id)).toEqual(["ok-1"]);
  });

  it("conserve le corps markdown du fichier", async () => {
    await write("---\ntype: torch-config\nthemes: []\n---\n\n# Mes notes à moi\n");
    await createTheme(week);
    expect(await fs.readFile(file, "utf8")).toContain("# Mes notes à moi");
  });

  it("n'explose pas sur un YAML cassé", async () => {
    await write("---\ntype: torch-config\nthemes: [\n---\n");
    expect(await listThemes()).toEqual([]);
  });

  it("liste vide quand le fichier n'existe pas", async () => {
    expect(await listThemes()).toEqual([]);
  });
});

describe("un seul thème par période", () => {
  it("refuse un thème qui chevauche un autre", async () => {
    await createTheme(week);
    await expect(
      createTheme({ start: "2026-09-24", end: "2026-09-30", label: "Second" }),
    ).rejects.toBeInstanceOf(ThemeOverlapError);
    expect(await listThemes()).toHaveLength(1);
  });

  it("refuse un thème identique", async () => {
    await createTheme(week);
    await expect(createTheme({ ...week, label: "Autre nom" })).rejects.toBeInstanceOf(
      ThemeOverlapError,
    );
  });

  it("accepte la semaine d'à côté", async () => {
    await createTheme(week);
    await createTheme({ start: "2026-09-28", end: "2026-10-04", label: "Suivante" });
    expect(await listThemes()).toHaveLength(2);
  });

  it("un thème peut se modifier sans se chevaucher lui-même", async () => {
    const { id } = await createTheme(week);
    const updated = await updateTheme(id, { ...week, label: "Renommé" });
    expect(updated.label).toBe("Renommé");
  });

  it("mais ne peut pas se déplacer sur la semaine d'un autre", async () => {
    const { id } = await createTheme(week);
    await createTheme({ start: "2026-09-28", end: "2026-10-04", label: "Suivante" });
    await expect(
      updateTheme(id, { start: "2026-09-28", end: "2026-10-04", label: "Collision" }),
    ).rejects.toBeInstanceOf(ThemeOverlapError);
  });

  it("deux créations simultanées : une seule passe", async () => {
    const results = await Promise.allSettled([
      createTheme(week),
      createTheme({ ...week, label: "Doublon" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await listThemes()).toHaveLength(1);
  });
});
