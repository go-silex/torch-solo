import path from "node:path";
import { getTorchZone } from "@/lib/config";
import {
  enqueueWrite,
  readConfigDoc,
  writeConfigDoc,
  yamlString,
} from "@/lib/services/config-file";
import {
  DEFAULT_RHYTHM,
  WEEKDAYS,
  toRhythm,
  type Rules,
  type RulesInput,
} from "@/lib/types/rules";

/**
 * Règles éditoriales — `_Config/Rules.md` (voir `config-file.ts` pour les
 * garanties). Le rythme hebdomadaire est dans le frontmatter pour que le
 * calendrier puisse l'afficher ; tout le reste est du markdown libre.
 */

const DEFAULT_BODY = `
# Règles éditoriales

Le rythme de la semaine est dans le frontmatter ci-dessus : c'est lui que Torch
affiche sur le calendrier. Ce qui suit est libre — tout ce qu'on veut se
rappeler avant de programmer un contenu.

## Sous le thème de la semaine

Le thème donne l'angle, le rythme donne la forme. Un mardi pendant une semaine
« Recrutement cohorte 1 » reste un tuto : un tuto qui sert le recrutement.
`;

function rulesFile(): string {
  return path.join(getTorchZone().configDir, "Rules.md");
}

export async function getRules(): Promise<Rules> {
  const { data, body } = await readConfigDoc(rulesFile(), DEFAULT_BODY);
  // Fichier absent ou sans rythme : on propose celui de l'équipe.
  const rhythm = "rhythm" in data ? toRhythm(data.rhythm) : DEFAULT_RHYTHM;
  return { rhythm, body };
}

export async function saveRules(input: RulesInput): Promise<Rules> {
  return enqueueWrite(rulesFile(), async () => {
    const current = await getRules();
    const next: Rules = {
      rhythm: input.rhythm !== undefined ? toRhythm(input.rhythm) : current.rhythm,
      body: input.body !== undefined ? input.body : current.body,
    };
    const lines: string[] = [];
    const days = WEEKDAYS.filter((d) => next.rhythm[d]);
    if (days.length === 0) {
      lines.push("rhythm: {}");
    } else {
      lines.push("rhythm:");
      for (const day of days) lines.push(`  ${day}: ${yamlString(next.rhythm[day]!)}`);
    }
    await writeConfigDoc(rulesFile(), lines, next.body);
    return next;
  });
}
