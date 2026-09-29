import { describe, expect, it } from "vitest";
import { linkedinPostDate } from "@/lib/published-date";

describe("linkedinPostDate", () => {
  it("lit la date dans une URL de post LinkedIn (activity-…)", () => {
    expect(
      linkedinPostDate(
        "https://www.linkedin.com/posts/pierre-paris_au-lieu-doffrir-des-bouteilles-de-vin-%C3%A0-activity-7484538527905652738-byAa",
      ),
    ).toBe("2026-07-19");
  });

  it("lit aussi le format urn:li:activity", () => {
    expect(linkedinPostDate("https://www.linkedin.com/feed/update/urn:li:activity:7484538527905652738/")).toBe(
      "2026-07-19",
    );
  });

  it("renvoie null sans id d'activité (lien court, autre plateforme)", () => {
    expect(linkedinPostDate("https://lnkd.in/p/eHv8n_JQ")).toBeNull();
    expect(linkedinPostDate(null)).toBeNull();
  });
});
