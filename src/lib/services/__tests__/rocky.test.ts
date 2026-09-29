import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { formatIdFor, topicFor } from "@/lib/services/rocky-client";
import { resolveAssetPath } from "@/lib/vault/assets";
import { resetConfigCache } from "@/lib/config";
import { ContentFrontmatterSchema, type Format, type Platform } from "@/lib/types/content";

function fm(over: { format?: Format; platforms?: Platform[]; title?: string }) {
  return ContentFrontmatterSchema.parse({
    type: "torch-content",
    id: "2026-08-07_X",
    title: over.title ?? "Un titre",
    format: over.format ?? "post",
    sel: "educate",
    emitter: "caroline",
    created: "2026-08-07",
    platforms: over.platforms ?? [],
  });
}

describe("formatIdFor", () => {
  it("suit la plateforme en priorité", () => {
    expect(formatIdFor(fm({ platforms: ["youtube"] }))).toBe("youtube");
    expect(formatIdFor(fm({ platforms: ["linkedin"] }))).toBe("linkedin-carre");
    expect(formatIdFor(fm({ platforms: ["reels"] }))).toBe("instagram-story");
  });

  it("retombe sur le format quand aucune plateforme n'est choisie", () => {
    expect(formatIdFor(fm({ format: "episode" }))).toBe("youtube");
    expect(formatIdFor(fm({ format: "short" }))).toBe("instagram-story");
    expect(formatIdFor(fm({ format: "post" }))).toBe("linkedin-carre");
    expect(formatIdFor(fm({ format: "newsletter" }))).toBe("paysage");
  });
});

describe("topicFor", () => {
  it("utilise le corps quand il dit quelque chose, sans le balisage", () => {
    const body = "## Hook\n\nLe **vrai** frein a l'IA, c'est l'habitude, pas la techno.";
    const topic = topicFor(fm({ title: "Le frein" }), body);
    expect(topic).toContain("Le frein");
    expect(topic).toContain("c'est l'habitude");
    expect(topic).not.toContain("##");
    expect(topic).not.toContain("**");
  });

  it("se rabat sur le titre quand le corps est un squelette vide", () => {
    expect(topicFor(fm({ title: "Mon titre" }), "## Hook\n\n## Notes\n")).toBe("Mon titre");
  });
});

describe("resolveAssetPath", () => {
  beforeAll(() => {
    process.env.TORCH_ASSETS_ROOT = "/tmp/torch-assets-test";
    resetConfigCache();
  });
  afterAll(() => {
    delete process.env.TORCH_ASSETS_ROOT;
    resetConfigCache();
  });

  it("accepte un chemin dans le dossier des images", () => {
    expect(resolveAssetPath("Images/x.png")).toBe("/tmp/torch-assets-test/Images/x.png");
  });

  it("refuse une évasion hors du dossier (frontmatter édité à la main)", () => {
    expect(resolveAssetPath("../../../../etc/passwd")).toBeNull();
    expect(resolveAssetPath("/etc/passwd")).toBeNull();
  });
});
