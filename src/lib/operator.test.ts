import { describe, expect, it } from "vitest";
import { operatorNameFromEmail } from "@/lib/operator";

describe("operatorNameFromEmail", () => {
  it("capitalise le local-part", () => {
    expect(operatorNameFromEmail("caroline@example.com")).toBe("Caroline");
  });

  it("est insensible à la casse", () => {
    expect(operatorNameFromEmail("CAROLINE@EXAMPLE.COM")).toBe("Caroline");
  });
});
