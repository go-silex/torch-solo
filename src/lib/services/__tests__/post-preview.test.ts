import { describe, expect, it } from "vitest";
import { extractPostText } from "@/components/content/post-preview";

const migrated = `
# J'ai passé 1h avec Martin Cregut

**Cible** : dirigeants de PME
**Objectif** : leads

---

## Version publiée

J'ai passé plus d'1h avec Martin Cregut.

Je lui ai partagé tout ce que l'on a mis en place.

- point un
- point deux
`;

describe("extractPostText", () => {
  it("prend la section Version publiée jusqu'à la fin, pas jusqu'à la fin de ligne", () => {
    const t = extractPostText(migrated);
    expect(t.startsWith("J'ai passé plus d'1h")).toBe(true);
    expect(t).toContain("• point deux");
    expect(t).not.toContain("Cible");
  });

  it("sans Version publiée : corps sans titres ni section Notes", () => {
    expect(extractPostText("\n## Hook\n\nMon accroche\n\n## Notes\n\n- interne\n")).toBe(
      "Mon accroche",
    );
  });
});
