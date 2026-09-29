import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { mapReviewStatus } from "@/lib/services/flame-client";
import {
  ShlinkError,
  deleteShortlink,
  slugForContent,
} from "@/lib/services/shlink-client";

describe("mapReviewStatus", () => {
  it("mappe les statuts Flame vers edit-status Torch", () => {
    expect(mapReviewStatus("in_review")).toBe("in-review");
    expect(mapReviewStatus("changes_requested")).toBe("changes-requested");
    expect(mapReviewStatus("approved")).toBe("approved");
    expect(mapReviewStatus("none")).toBe("editing");
  });
});

describe("slugForContent", () => {
  it("retire la date et kebab-case l'id", () => {
    expect(slugForContent("2026-08-06_Short_Claude_Code_Dirigeants")).toBe(
      "t-short-claude-code-dirigeants",
    );
  });
  it("tronque à 40 caractères après le préfixe", () => {
    const slug = slugForContent("2026-08-06_" + "Mot_".repeat(30));
    expect(slug.length).toBeLessThanOrEqual(42);
    expect(slug.startsWith("t-")).toBe(true);
  });
});

describe("deleteShortlink", () => {
  beforeAll(() => {
    // Prioritaire sur torch.env/Keychain (getSetting lit process.env d'abord).
    process.env.SHLINK_API_KEY = "test-key";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("envoie DELETE /short-urls/<slug> avec la clé, 204 = ok", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(deleteShortlink("t-mon-slug")).resolves.toBeUndefined();
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/short-urls/t-mon-slug");
    expect(init.method).toBe("DELETE");
    expect(init.headers["X-Api-Key"]).toBe("test-key");
  });

  it("404 = déjà absent chez Shlink, ne jette pas (idempotent)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status: 404 })),
    );
    await expect(deleteShortlink("t-deja-parti")).resolves.toBeUndefined();
  });

  it("422 (seuil de visites Shlink) = ShlinkError avec le détail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () =>
        new Response(
          JSON.stringify({ detail: "It has more than 15 visits" }),
          { status: 422 },
        ),
      ),
    );
    await expect(deleteShortlink("t-populaire")).rejects.toThrow(ShlinkError);
    await expect(deleteShortlink("t-populaire")).rejects.toThrow(/422/);
  });
});
