import { CLIENT_STRINGS as _$ } from "@/assets/data";
import type { ParsedStat } from "./stat-translations";
import { ModifierType } from "./modifiers";
import { removeLinesEnding } from "./Parser";

export const ENCHANT_LINE = " (enchant)";
export const IMPLICIT_LINE = " (implicit)";

export interface ParsedModifier {
  info: ModifierInfo;
  stats: ParsedStat[];
}

export interface ModifierInfo {
  type: ModifierType;
  generation?: "suffix" | "prefix" | "corrupted";
  name?: string;
  tier?: number;
  rank?: number;
  tags: string[];
  rollIncr?: number;
}

export function parseModInfoLine(
  line: string,
  type: ModifierType
): ModifierInfo {
  const [modText, xText2, xText3] = line
    .slice(1, -1)
    .split("\u2014")
    .map((_) => _.trim());

  let generation: ModifierInfo["generation"];
  let name: ModifierInfo["name"];
  let tier: ModifierInfo["tier"];
  let rank: ModifierInfo["rank"];

  const match = modText.match(_$.MODIFIER_LINE);
  if (!match) {
    throw new Error("Invalid regex for mod info line");
  }

  switch (match.groups!.type) {
    case _$.PREFIX_MODIFIER:
    case _$.SUFFIX_MODIFIER:
    case _$.CORRUPTED_IMPLICIT:
      generation = "corrupted";
      break;
  }

  name = match.groups!.name || undefined;
  tier = Number(match.groups!.tier) || undefined;
  rank = Number(match.groups!.rank) || undefined;

  let tags: ModifierInfo["tags"];
  let rollIncr: ModifierInfo["rollIncr"];
  {
    const incrText =
      xText3 !== undefined
        ? xText3
        : xText2 !== undefined && _$.MODIFIER_INCREASED.test(xText2)
        ? xText2
        : undefined;

    const tagsText =
      xText2 !== undefined && incrText !== xText2 ? xText2 : undefined;

    tags = tagsText ? tagsText.split(", ") : [];
    rollIncr = incrText
      ? Number(_$.MODIFIER_INCREASED.exec(incrText)![1])
      : undefined;
  }

  return { type, generation, name, tier, rank, tags, rollIncr };
}

export function isModInfoLine(line: string): boolean {
  return line.startsWith("{") && line.endsWith("}");
}

interface GroupedModLines {
  modLine: string;
  statLines: string[];
}

export function* groupLinesByMod(
  lines: string[]
): Generator<GroupedModLines, void> {
  if (!lines.length || !isModInfoLine(lines[0])) {
    return;
  }

  let last: GroupedModLines | undefined;
  for (const line of lines) {
    if (!isModInfoLine(line)) {
      last!.statLines.push(line);
    } else {
      if (last) {
        yield last;
      }
      last = { modLine: line, statLines: [] };
    }
  }
  yield last!;
}

export function parseModType(lines: string[]): {
  modType: ModifierType;
  lines: string[];
} {
  let modType: ModifierType;
  if (lines.some((line) => line.endsWith(ENCHANT_LINE))) {
    modType = ModifierType.Enchant;
    lines = removeLinesEnding(lines, ENCHANT_LINE);
  } else if (lines.some((line) => line.endsWith(IMPLICIT_LINE))) {
    modType = ModifierType.Implicit;
    lines = removeLinesEnding(lines, IMPLICIT_LINE);
  } else {
    modType = ModifierType.Explicit;
  }

  return { modType, lines };
}

// stat values internally stored as ints,
// this is the most common formatter
const DIV_BY_100 = 2;

export function applyIncr(
  mod: ModifierInfo,
  parsed: ParsedStat
): ParsedStat | null {
  const { rollIncr } = mod;
  const { roll } = parsed;

  if (!rollIncr || !roll || roll.unscalable) {
    return null;
  }

  return {
    stat: parsed.stat,
    translation: parsed.translation,
    roll: {
      unscalable: roll.unscalable,
      dp: roll.dp,
      value: incrRoll(roll.value, rollIncr, roll.dp ? DIV_BY_100 : 0),
      min: incrRoll(roll.min, rollIncr, roll.dp ? DIV_BY_100 : 0),
      max: incrRoll(roll.max, rollIncr, roll.dp ? DIV_BY_100 : 0),
    },
  };
}

export function incrRoll(value: number, p: number, dp: number): number {
  const res = value + (value * p) / 100;
  const rounding = Math.pow(10, dp);
  return Math.trunc((res + Number.EPSILON) * rounding) / rounding;
}
