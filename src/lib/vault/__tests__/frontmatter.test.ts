import { describe, expect, it } from "vitest";
import {
  parseContentFile,
  serializeContentFile,
  serializeFrontmatter,
  splitFrontmatter,
} from "@/lib/vault/frontmatter";
import { ContentFrontmatterSchema, STATUSES } from "@/lib/types/content";

const minimalFm = ContentFrontmatterSchema.parse({
  type: "torch-content",
  id: "2026-08-06_Test",
  title: "Test",
  format: "post",
  sel: "educate",
  emitter: "caroline",
  created: "2026-08-06",
});

describe("splitFrontmatter", () => {
  it("sépare frontmatter et corps", () => {
    const raw = "---\na: 1\n---\ncorps";
    const split = splitFrontmatter(raw);
    expect(split).not.toBeNull();
    expect(split!.yamlSource).toBe("a: 1\n");
    expect(split!.body).toBe("corps");
  });

  it("ne confond pas un --- dans le corps avec la fermeture", () => {
    const raw = "---\na: 1\n---\navant\n---\naprès";
    const split = splitFrontmatter(raw);
    expect(split!.body).toBe("avant\n---\naprès");
  });

  it("rejette un fichier sans frontmatter", () => {
    expect(splitFrontmatter("juste du texte")).toBeNull();
  });
});

describe("parseContentFile", () => {
  it("parse une fiche valide et garde les dates comme chaînes", () => {
    const raw = serializeContentFile(minimalFm, "\n## Hook\n");
    const parsed = parseContentFile(raw);
    expect("fm" in parsed).toBe(true);
    if ("fm" in parsed) {
      expect(parsed.fm.created).toBe("2026-08-06");
      expect(typeof parsed.fm.created).toBe("string");
    }
  });

  it("retourne une erreur lisible sur YAML cassé", () => {
    const parsed = parseContentFile("---\n: : :\n---\ncorps");
    expect("error" in parsed).toBe(true);
  });

  it("retourne une erreur sur schéma invalide", () => {
    const parsed = parseContentFile(
      "---\ntype: torch-content\nid: x\ntitle: x\nformat: nope\nsel: educate\nemitter: caroline\ncreated: 2026-08-06\n---\n",
    );
    expect("error" in parsed).toBe(true);
  });
});

describe("préservation du corps (byte-for-byte)", () => {
  const bodies = [
    "\n## Hook\nDu texte avec émoji 🔥 et [[wikilink|alias]]\n",
    "\r\nCRLF\r\npréservé\r\n",
    "\n---\nSéparateur dans le corps\n---\n",
    "", // corps vide
    "sans saut de ligne final",
    "\n```yaml\n---\nkey: value\n---\n```\n",
  ];

  for (const [i, body] of bodies.entries()) {
    it(`round-trip corps #${i}`, () => {
      const raw = serializeContentFile(minimalFm, body);
      const parsed = parseContentFile(raw);
      expect("fm" in parsed).toBe(true);
      if ("fm" in parsed) {
        expect(Buffer.from(parsed.body)).toEqual(Buffer.from(body));
      }
    });
  }
});

describe("sérialisation déterministe", () => {
  it("est idempotente : serialize(parse(serialize(x))) === serialize(x)", () => {
    const once = serializeFrontmatter(minimalFm);
    const parsed = parseContentFile(once + "corps");
    if (!("fm" in parsed)) throw new Error("parse failed");
    const twice = serializeFrontmatter(parsed.fm);
    expect(twice).toBe(once);
  });

  it("préserve les champs inconnus au round-trip (à la fin, triés)", () => {
    const withExtra = ContentFrontmatterSchema.parse({
      ...minimalFm,
      "zz-custom": "valeur",
      "aa-custom": 42,
    });
    const raw = serializeFrontmatter(withExtra);
    const parsed = parseContentFile(raw + "x");
    if (!("fm" in parsed)) throw new Error("parse failed");
    expect((parsed.fm as Record<string, unknown>)["zz-custom"]).toBe("valeur");
    expect((parsed.fm as Record<string, unknown>)["aa-custom"]).toBe(42);
    const aa = raw.indexOf("aa-custom");
    const zz = raw.indexOf("zz-custom");
    expect(aa).toBeGreaterThan(-1);
    expect(zz).toBeGreaterThan(aa);
  });

  it("quote les chaînes ambiguës et garde les slugs plain", () => {
    const fm = ContentFrontmatterSchema.parse({
      ...minimalFm,
      title: 'Titre : avec "quotes" et accents é',
      editor: "mounir",
    });
    const raw = serializeFrontmatter(fm);
    expect(raw).toContain("editor: mounir");
    expect(raw).toContain(`title: ${JSON.stringify('Titre : avec "quotes" et accents é')}`);
    const parsed = parseContentFile(raw + "x");
    if (!("fm" in parsed)) throw new Error("parse failed");
    expect(parsed.fm.title).toBe('Titre : avec "quotes" et accents é');
  });

  it("sérialise les objets imbriqués (metrics) et les relit", () => {
    const fm = ContentFrontmatterSchema.parse({
      ...minimalFm,
      metrics: { clicks: 42, instagram: { views: 1200, likes: 80 } },
      "published-urls": { instagram: "https://instagram.com/p/x", tiktok: null },
    });
    const raw = serializeFrontmatter(fm);
    const parsed = parseContentFile(raw + "x");
    if (!("fm" in parsed)) throw new Error("parse failed");
    expect(parsed.fm.metrics).toEqual({
      clicks: 42,
      instagram: { views: 1200, likes: 80 },
    });
    expect(parsed.fm["published-urls"]).toEqual({
      instagram: "https://instagram.com/p/x",
      tiktok: null,
    });
  });

  it("tolère un YAML étranger (clés désordonnées, quotes exotiques)", () => {
    const messy = `---
title: 'Titre en quotes simples'
emitter: "caroline"
created: 2026-08-06
sel: educate
format: post
id: 2026-08-06_Messy
type: torch-content
extra-inconnu: [a, b]
---
corps`;
    const parsed = parseContentFile(messy);
    expect("fm" in parsed).toBe(true);
    if ("fm" in parsed) {
      expect(parsed.fm.title).toBe("Titre en quotes simples");
      const reserialized = serializeFrontmatter(parsed.fm);
      const reparsed = parseContentFile(reserialized + "x");
      if (!("fm" in reparsed)) throw new Error("reparse failed");
      expect(serializeFrontmatter(reparsed.fm)).toBe(reserialized);
    }
  });
});

describe("taxonomie alignée sur le Content Calendar", () => {
  const base = {
    type: "torch-content",
    id: "2026-09-15_Taxo",
    title: "Taxo",
    format: "post",
    sel: "story",
    emitter: "ryse",
    created: "2026-09-15",
  };

  it("convertit les anciennes plateformes au lieu de mettre la note en quarantaine", () => {
    const fm = ContentFrontmatterSchema.parse({
      ...base,
      platforms: ["linkedin", "instagram", "tiktok", "x", "site"],
    });
    // instagram et tiktok fusionnent dans reels ; x et site ont retrouvé une
    // plateforme à eux (twitter, blog) le 2026-09-22.
    expect(fm.platforms).toEqual(["linkedin", "reels", "twitter", "blog"]);
  });

  it("catégorie nulle et objectifs vides par défaut, rangés après le pilier", () => {
    const fm = ContentFrontmatterSchema.parse(base);
    expect(fm.category).toBeNull();
    expect(fm.goals).toEqual([]);
    const yaml = serializeFrontmatter({ ...fm, category: "interview", goals: ["leads", "branding"] });
    expect(yaml).toContain("pillar: none\ncategory: interview\ngoals: [leads, branding]\n");
  });

  it("rejette une catégorie hors liste", () => {
    expect(ContentFrontmatterSchema.safeParse({ ...base, category: "podcast" }).success).toBe(false);
  });
});

describe("refonte de taxonomie du 2026-09-22", () => {
  const base = {
    type: "torch-content",
    id: "2026-09-22_Test",
    title: "Test",
    format: "post",
    emitter: "caroline",
    created: "2026-09-22",
  };

  it("convertit les anciens piliers au lieu de mettre la note en quarantaine", () => {
    const of = (pillar: string) =>
      ContentFrontmatterSchema.parse({ ...base, pillar }).pillar;
    expect(of("futur-du-travail")).toBe("thought-leadership");
    expect(of("le-chantier")).toBe("builders");
    expect(of("blueprint-ai-native")).toBe("methode");
    expect(of("none")).toBe("none");
  });

  it("accepte déjà les nouveaux noms de pilier", () => {
    expect(ContentFrontmatterSchema.parse({ ...base, pillar: "builders" }).pillar).toBe("builders");
  });

  it("rejette toujours un pilier inventé", () => {
    expect(ContentFrontmatterSchema.safeParse({ ...base, pillar: "case-studies" }).success).toBe(
      false,
    );
  });

  it("replie coulisses-bootcamp sur behind-the-scenes", () => {
    const fm = ContentFrontmatterSchema.parse({ ...base, category: "coulisses-bootcamp" });
    expect(fm.category).toBe("behind-the-scenes");
  });

  it("une catégorie nulle le reste", () => {
    expect(ContentFrontmatterSchema.parse({ ...base, category: null }).category).toBeNull();
  });

  it("une fiche sans sel est valide", () => {
    const parsed = ContentFrontmatterSchema.safeParse(base);
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.sel).toBeUndefined();
  });

  it("le sel des fiches qui en ont un est conservé à la réécriture", () => {
    const fm = ContentFrontmatterSchema.parse({ ...base, sel: "educate" });
    expect(serializeFrontmatter(fm)).toContain("sel: educate");
  });

  it("une fiche sans sel ne se voit pas ajouter la clé", () => {
    const fm = ContentFrontmatterSchema.parse(base);
    expect(serializeFrontmatter(fm)).not.toContain("sel:");
  });

  it("les étapes de production s'intercalent entre brouillon et prêt", () => {
    // L'ordre de STATUSES est l'ordre des colonnes du kanban.
    const order = STATUSES.indexOf.bind(STATUSES);
    for (const step of ["to-shoot", "shot", "to-edit", "edited"] as const) {
      expect(order(step)).toBeGreaterThan(order("draft"));
      expect(order(step)).toBeLessThan(order("ready"));
    }
    expect(order("to-shoot")).toBeLessThan(order("shot"));
    expect(order("to-edit")).toBeLessThan(order("edited"));
  });

  it("accepte une fiche déjà posée sur une étape de production", () => {
    const fm = ContentFrontmatterSchema.parse({ ...base, format: "short", status: "to-shoot" });
    expect(fm.status).toBe("to-shoot");
  });

  it("une fiche de l'ancien monde se relit entièrement", () => {
    const raw = [
      "---",
      "type: torch-content",
      "schema: 1",
      "id: 2026-09-21_Ancienne",
      "title: \"Ancienne fiche\"",
      "format: post",
      "platforms: [linkedin]",
      "pillar: blueprint-ai-native",
      "category: coulisses-bootcamp",
      "goals: [branding]",
      "sel: educate",
      "emitter: ryse",
      "status: published",
      "created: 2026-09-21",
      "---",
      "",
      "corps",
    ].join("\n");
    const parsed = parseContentFile(raw);
    expect("fm" in parsed).toBe(true);
    if (!("fm" in parsed)) return;
    expect(parsed.fm.pillar).toBe("methode");
    expect(parsed.fm.category).toBe("behind-the-scenes");
    expect(parsed.fm.sel).toBe("educate");
  });
});
