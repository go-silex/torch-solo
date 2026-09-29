import { describe, expect, it } from "vitest";
import { neighboursIn } from "@/lib/hooks/use-content-queue";

const ids = ["a", "b", "c"];

describe("neighboursIn", () => {
  it("donne les deux voisins au milieu", () => {
    expect(neighboursIn(ids, "b")).toEqual({ prev: "a", next: "c", position: 2, total: 3 });
  });

  it("pas de précédent sur la première", () => {
    expect(neighboursIn(ids, "a")).toMatchObject({ prev: null, next: "b", position: 1 });
  });

  it("pas de suivant sur la dernière", () => {
    expect(neighboursIn(ids, "c")).toMatchObject({ prev: "b", next: null, position: 3 });
  });

  it("fiche absente de la file : aucune flèche, aucun rang", () => {
    expect(neighboursIn(ids, "z")).toEqual({ prev: null, next: null, position: 0, total: 3 });
  });

  it("file d'une seule fiche : on ne va nulle part", () => {
    expect(neighboursIn(["a"], "a")).toMatchObject({ prev: null, next: null, total: 1 });
  });

  it("file vide", () => {
    expect(neighboursIn([], "a")).toEqual({ prev: null, next: null, position: 0, total: 0 });
  });
});
