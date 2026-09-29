import { describe, expect, it } from "vitest";
import { themeHue } from "@/lib/labels";
import {
  addDays,
  byCalendarDate,
  daysFrom,
  isWeekend,
  monthGrid,
  mondayOf,
  toIso,
  weekIndex,
  weekRange,
} from "@/lib/dates";

describe("mondayOf", () => {
  it("ramène au lundi de la semaine", () => {
    expect(toIso(mondayOf(new Date(2026, 8, 17)))).toBe("2026-09-14"); // jeudi
    expect(toIso(mondayOf(new Date(2026, 8, 14)))).toBe("2026-09-14"); // lundi
    expect(toIso(mondayOf(new Date(2026, 8, 20)))).toBe("2026-09-14"); // dimanche
  });
});

describe("addDays", () => {
  it("passe les fins de mois et d'année", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("ignore les changements d'heure", () => {
    expect(addDays("2026-03-28", 1)).toBe("2026-03-29");
    expect(addDays("2026-03-29", 1)).toBe("2026-03-30");
    expect(addDays("2026-10-24", 2)).toBe("2026-10-26");
  });
});

describe("daysFrom", () => {
  it("donne 7 jours glissants à partir d'un jeudi", () => {
    expect(daysFrom("2026-09-17")).toEqual([
      "2026-09-17",
      "2026-09-18",
      "2026-09-19",
      "2026-09-20",
      "2026-09-21",
      "2026-09-22",
      "2026-09-23",
    ]);
  });

  it("chevauche deux mois", () => {
    const days = daysFrom("2026-09-30");
    expect(days[0]).toBe("2026-09-30");
    expect(days[6]).toBe("2026-10-06");
  });
});

describe("isWeekend", () => {
  it("se base sur la date, pas sur la colonne", () => {
    expect(isWeekend("2026-09-19")).toBe(true); // samedi
    expect(isWeekend("2026-09-20")).toBe(true); // dimanche
    expect(isWeekend("2026-09-21")).toBe(false); // lundi
    expect(isWeekend("2026-09-17")).toBe(false); // jeudi
  });
});

describe("monthGrid", () => {
  it("couvre le mois en semaines complètes du lundi au dimanche", () => {
    const weeks = monthGrid(2026, 8); // septembre
    expect(weeks).toHaveLength(5);
    expect(weeks[0][0]).toBe("2026-08-31");
    expect(weeks[4][6]).toBe("2026-10-04");
    expect(weeks.every((w) => w.length === 7)).toBe(true);
  });
});

describe("weekRange", () => {
  it("renvoie lundi → dimanche de la semaine d'un jeudi", () => {
    expect(weekRange("2026-09-24")).toEqual({ start: "2026-09-21", end: "2026-09-27" });
  });
  it("un dimanche appartient à la semaine qui précède", () => {
    expect(weekRange("2026-09-27")).toEqual({ start: "2026-09-21", end: "2026-09-27" });
  });
  it("traverse un changement de mois", () => {
    expect(weekRange("2026-10-01")).toEqual({ start: "2026-09-28", end: "2026-10-04" });
  });
});

describe("weekIndex et couleur de thème", () => {
  it("avance d'une unité par semaine, quel que soit le jour", () => {
    expect(weekIndex("2026-09-24") + 1).toBe(weekIndex("2026-10-01"));
    expect(weekIndex("2026-09-21")).toBe(weekIndex("2026-09-27"));
  });

  it("deux semaines voisines n'ont jamais la même couleur", () => {
    let iso = "2026-01-05";
    for (let i = 0; i < 60; i++) {
      const next = addDays(iso, 7);
      expect(themeHue(weekIndex(iso))).not.toBe(themeHue(weekIndex(next)));
      iso = next;
    }
  });

  it("la couleur revient toutes les cinq semaines", () => {
    expect(themeHue(weekIndex("2026-01-05"))).toBe(themeHue(weekIndex("2026-02-09")));
  });
});

describe("byCalendarDate", () => {
  const fiche = (over: Record<string, unknown>) =>
    ({
      id: "x",
      title: "T",
      status: "idea",
      planned: null,
      "published-at": null,
      created: "2026-01-01",
      ...over,
    }) as never;

  it("trie par date affichée", () => {
    const a = fiche({ planned: "2026-09-21" });
    const b = fiche({ planned: "2026-09-24" });
    expect([b, a].sort(byCalendarDate)).toEqual([a, b]);
  });

  it("un publié se range à sa date de publication", () => {
    const publie = fiche({ status: "published", "published-at": "2026-09-20", planned: "2026-09-30" });
    const prevu = fiche({ planned: "2026-09-25" });
    expect([prevu, publie].sort(byCalendarDate)).toEqual([publie, prevu]);
  });

  it("les fiches sans date passent à la fin, la plus récente d'abord", () => {
    const date = fiche({ planned: "2026-09-21" });
    const vieux = fiche({ created: "2026-01-01" });
    const recent = fiche({ created: "2026-09-01" });
    expect([vieux, recent, date].sort(byCalendarDate)).toEqual([date, recent, vieux]);
  });

  it("à date égale, l'ordre reste stable (par titre)", () => {
    const a = fiche({ planned: "2026-09-21", title: "Alpha" });
    const b = fiche({ planned: "2026-09-21", title: "Beta" });
    expect([b, a].sort(byCalendarDate)).toEqual([a, b]);
  });
});
