import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetConfigCache } from "@/lib/config";
import { getRules, saveRules } from "@/lib/services/rules";
import { DEFAULT_RHYTHM, rhythmFor, weekdayOf } from "@/lib/types/rules";

let vaultRoot: string;
let file: string;

beforeEach(async () => {
  vaultRoot = await fs.mkdtemp(path.join(tmpdir(), "torch-rules-"));
  process.env.TORCH_VAULT_ROOT = vaultRoot;
  resetConfigCache();
  file = path.join(vaultRoot, "Torch", "_Config", "Rules.md");
});

afterEach(async () => {
  delete process.env.TORCH_VAULT_ROOT;
  resetConfigCache();
  await fs.rm(vaultRoot, { recursive: true, force: true });
});

describe("getRules", () => {
  it("propose le rythme de l'équipe quand le fichier n'existe pas", async () => {
    const rules = await getRules();
    expect(rules.rhythm).toEqual(DEFAULT_RHYTHM);
    expect(rules.body).toContain("Règles éditoriales");
  });

  it("un rythme vide écrit à la main reste vide", async () => {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, "---\ntype: torch-config\nrhythm: {}\n---\n\nRien.\n", "utf8");
    expect((await getRules()).rhythm).toEqual({});
  });

  it("ignore les clés qui ne sont pas des jours", async () => {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(
      file,
      "---\ntype: torch-config\nrhythm:\n  monday: Podcast\n  funday: Nope\n---\n",
      "utf8",
    );
    expect((await getRules()).rhythm).toEqual({ monday: "Podcast" });
  });

  it("n'explose pas sur un YAML cassé", async () => {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, "---\ntype: torch-config\nrhythm: [\n---\n", "utf8");
    await expect(getRules()).resolves.toBeTruthy();
  });
});

describe("saveRules", () => {
  it("écrit le rythme et le relit", async () => {
    await saveRules({ rhythm: { monday: "Mise en avant podcast", thursday: "Épisode" } });
    const rules = await getRules();
    expect(rules.rhythm).toEqual({ monday: "Mise en avant podcast", thursday: "Épisode" });
    expect(await fs.readFile(file, "utf8")).toContain("type: torch-config");
  });

  it("enregistrer le corps ne touche pas au rythme", async () => {
    await saveRules({ rhythm: { monday: "Podcast" } });
    await saveRules({ body: "# Nouvelles règles\n" });
    const rules = await getRules();
    expect(rules.rhythm).toEqual({ monday: "Podcast" });
    expect(rules.body).toBe("# Nouvelles règles\n");
  });

  it("enregistrer le rythme ne touche pas au corps", async () => {
    await saveRules({ body: "# À garder\n" });
    await saveRules({ rhythm: { friday: "Fun" } });
    expect((await getRules()).body).toBe("# À garder\n");
  });

  it("un intitulé vide retire le jour", async () => {
    await saveRules({ rhythm: { monday: "Podcast", tuesday: "Tuto" } });
    await saveRules({ rhythm: { monday: "Podcast", tuesday: "   " } });
    expect((await getRules()).rhythm).toEqual({ monday: "Podcast" });
  });

  it("garde un intitulé à deux-points relisible", async () => {
    await saveRules({ rhythm: { monday: "Podcast : le totem de la semaine" } });
    expect((await getRules()).rhythm.monday).toBe("Podcast : le totem de la semaine");
  });

  it("écrit hors du dossier Content", async () => {
    await saveRules({ rhythm: { monday: "Podcast" } });
    await expect(
      fs.stat(path.join(vaultRoot, "Torch", "Content")),
    ).rejects.toThrow();
  });
});

describe("weekdayOf / rhythmFor", () => {
  it("lundi est bien lundi", () => {
    expect(weekdayOf("2026-09-21")).toBe("monday");
    expect(weekdayOf("2026-09-27")).toBe("sunday");
  });
  it("renvoie l'intitulé du jour, null si vide", () => {
    const rhythm = { tuesday: "Tuto" };
    expect(rhythmFor(rhythm, "2026-09-22")).toBe("Tuto");
    expect(rhythmFor(rhythm, "2026-09-23")).toBeNull();
  });
});
