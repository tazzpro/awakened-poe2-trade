import { Result, ok, err } from "neverthrow";
import {
  CLIENT_STRINGS as _$,
  CLIENT_STRINGS_REF as _$REF,
  ITEM_BY_TRANSLATED,
  ITEM_BY_REF,
  STAT_BY_MATCH_STR,
  BaseType,
} from "@/assets/data";
import { ModifierType, sumStatsByModType } from "./modifiers";
import {
  linesToStatStrings,
  tryParseTranslation,
  getRollOrMinmaxAvg,
} from "./stat-translations";
import { ItemCategory } from "./meta";
import { ParsedItem, ItemRarity } from "./ParsedItem";
import { magicBasetype } from "./magic-name";
import {
  isModInfoLine,
  groupLinesByMod,
  parseModInfoLine,
  parseModType,
  ModifierInfo,
  ParsedModifier,
  ENCHANT_LINE,
  IMPLICIT_LINE,
} from "./advanced-mod-desc";
import { calcPropPercentile, QUALITY_STATS } from "./calc-q20";

type SectionParseResult =
  | "SECTION_PARSED"
  | "SECTION_SKIPPED"
  | "PARSER_SKIPPED";

type ParserFn = (section: string[], item: ParserState) => SectionParseResult;
type VirtualParserFn = (item: ParserState) => Result<never, string> | void;

interface ParserState extends ParsedItem {
  name: string;
  baseType: string | undefined;
  infoVariants: BaseType[];
}

const parsers: Array<ParserFn | { virtual: VirtualParserFn }> = [
  parseUnidentified,
  { virtual: parseSuperior },
  { virtual: normalizeName },
  parseVaalGemName,
  { virtual: findInDatabase },
  // -----------
  parseItemLevel,
  parseGem,
  parseArmour,
  parseWeapon,
  parseFlask,
  parseStackSize,
  parseCorrupted,
  parseFoil,
  parseWaystone,
  parseSockets,
  parseAreaLevel,
  parseMirroredTablet,
  parseMirrored,
  parseLogbookArea,
  parseLogbookArea,
  parseLogbookArea,
  parseModifiers, // enchant
  parseModifiers, // scourge
  parseModifiers, // implicit
  parseModifiers, // explicit
  { virtual: transformToLegacyModifiers },
  { virtual: pickCorrectVariant },
  { virtual: calcBasePercentile },
];

export function parseClipboard(clipboard: string): Result<ParsedItem, string> {
  try {
    let sections = itemTextToSections(clipboard);

    if (sections[0][2] === _$.CANNOT_USE_ITEM) {
      sections[0].pop(); // remove CANNOT_USE_ITEM line
      sections[1].unshift(...sections[0]); // prepend item class & rarity into second section
      sections.shift(); // remove first section where CANNOT_USE_ITEM line was
    }
    const parsed = parseNamePlate(sections[0]);
    if (!parsed.isOk()) return parsed;

    sections.shift();
    parsed.value.rawText = clipboard;

    // each section can be parsed at most by one parser
    for (const parser of parsers) {
      if (typeof parser === "object") {
        const error = parser.virtual(parsed.value);
        if (error) return error;
        continue;
      }

      for (const section of sections) {
        const result = parser(section, parsed.value);
        if (result === "SECTION_PARSED") {
          sections = sections.filter((s) => s !== section);
          break;
        } else if (result === "PARSER_SKIPPED") {
          break;
        }
      }
    }
    return Object.freeze(parsed);
  } catch (e) {
    console.log(e);
    return err("item.parse_error");
  }
}

function itemTextToSections(text: string) {
  const lines = text.split(/\r?\n/);
  if (lines[lines.length - 1] === "") {
    lines.pop();
  }

  const sections: string[][] = [[]];
  lines.reduce((section, line) => {
    if (line !== "--------") {
      section.push(line);
      return section;
    } else {
      const section: string[] = [];
      sections.push(section);
      return section;
    }
  }, sections[0]);
  return sections.filter((section) => section.length);
}

function normalizeName(item: ParserState) {
  if (item.rarity === ItemRarity.Magic) {
    const baseType = magicBasetype(item.name);
    if (baseType) {
      item.name = baseType;
    }
  }
}

function findInDatabase(item: ParserState) {
  let info: BaseType[] | undefined;
  if (item.category === ItemCategory.Gem) {
    info = ITEM_BY_REF("GEM", item.name);
  } else if (item.rarity === ItemRarity.Unique && !item.isUnidentified) {
    info = ITEM_BY_REF("UNIQUE", item.name);
  } else {
    info = ITEM_BY_REF("ITEM", item.baseType ?? item.name);
  }
  if (!info?.length) {
    return err("item.unknown");
  }
  if (info[0].unique) {
    info = info.filter((info) => info.unique!.base === item.baseType);
  }
  item.infoVariants = info;
  // choose 1st variant, correct one will be picked at the end of parsing
  item.info = info[0];
  // same for every variant
  if (!item.category) {
    if (item.info.craftable) {
      item.category = item.info.craftable.category;
    } else if (item.info.unique) {
      item.category = ITEM_BY_REF(
        "ITEM",
        item.info.unique.base
      )![0].craftable!.category;
    }
  }
}

function parseWaystone(section: string[], item: ParsedItem) {
  if (section[0].startsWith(_$.WAYSTONE_TIER)) {
    item.waystoneTier = Number(section[0].slice(_$.WAYSTONE_TIER.length));
    return "SECTION_PARSED";
  }
  return "SECTION_SKIPPED";
}

function pickCorrectVariant(item: ParserState) {
  if (!item.info.disc) return;

  for (const variant of item.infoVariants) {
    const cond = variant.disc!;

    if (cond.propAR && !item.armourAR) continue;
    if (cond.propEV && !item.armourEV) continue;
    if (cond.propES && !item.armourES) continue;

    if (cond.waystoneTier === "W" && !(item.waystoneTier! <= 5)) continue;
    if (
      cond.waystoneTier === "Y" &&
      !(item.waystoneTier! >= 6 && item.waystoneTier! <= 10)
    )
      continue;
    if (cond.waystoneTier === "R" && !(item.waystoneTier! >= 11)) continue;

    if (
      cond.hasImplicit &&
      !item.statsByType.some(
        (calc) =>
          calc.type === ModifierType.Implicit &&
          calc.stat.ref === cond.hasImplicit!.ref
      )
    )
      continue;

    if (
      cond.hasExplicit &&
      !item.statsByType.some(
        (calc) =>
          calc.type === ModifierType.Explicit &&
          calc.stat.ref === cond.hasExplicit!.ref
      )
    )
      continue;

    if (cond.sectionText && !item.rawText.includes(cond.sectionText)) continue;

    item.info = variant;
  }

  // it may happen that we don't find correct variant
  // i.e. corrupted implicit on Two-Stone Ring
}

function parseNamePlate(section: string[]) {
  let line = section.shift();
  if (!line?.startsWith(_$.ITEM_CLASS)) {
    return err("item.parse_error");
  }

  line = section.shift();
  let rarityText: string | undefined;
  if (line?.startsWith(_$.RARITY)) {
    rarityText = line.slice(_$.RARITY.length);
    line = section.shift();
  }

  let name: string;
  if (line != null) {
    name = markupConditionParser(line);
  } else {
    return err("item.parse_error");
  }

  line = section.shift();
  const baseType = line && markupConditionParser(line);

  const item: ParserState = {
    rarity: undefined,
    category: undefined,
    name: name,
    baseType: baseType,
    isUnidentified: false,
    isCorrupted: false,
    newMods: [],
    statsByType: [],
    unknownModifiers: [],
    info: undefined!,
    infoVariants: undefined!,
    rawText: undefined!,
  };

  switch (rarityText) {
    case _$.RARITY_CURRENCY:
      item.category = ItemCategory.Currency;
      break;
    case _$.RARITY_GEM:
      item.category = ItemCategory.Gem;
      break;
    case _$.RARITY_NORMAL:
    case _$.RARITY_QUEST:
      item.rarity = ItemRarity.Normal;
      break;
    case _$.RARITY_MAGIC:
      item.rarity = ItemRarity.Magic;
      break;
    case _$.RARITY_RARE:
      item.rarity = ItemRarity.Rare;
      break;
    case _$.RARITY_UNIQUE:
      item.rarity = ItemRarity.Unique;
      break;
  }

  return ok(item);
}

function parseCorrupted(section: string[], item: ParsedItem) {
  if (section[0] === _$.CORRUPTED) {
    item.isCorrupted = true;
    return "SECTION_PARSED";
  } else if (section[0] === _$.UNMODIFIABLE) {
    item.isCorrupted = true;
    item.isUnmodifiable = true;
    return "SECTION_PARSED";
  }
  return "SECTION_SKIPPED";
}

function parseFoil(section: string[], item: ParsedItem) {
  if (item.rarity !== ItemRarity.Unique) {
    return "PARSER_SKIPPED";
  }
  if (section[0] === _$.FOIL_UNIQUE) {
    item.isFoil = true;
    return "SECTION_PARSED";
  }
  return "SECTION_SKIPPED";
}

function parseUnidentified(section: string[], item: ParsedItem) {
  if (section[0] === _$.UNIDENTIFIED) {
    item.isUnidentified = true;
    return "SECTION_PARSED";
  }
  return "SECTION_SKIPPED";
}

function parseItemLevel(section: string[], item: ParsedItem) {
  let prefix = _$.ITEM_LEVEL;
  if (item.info.refName === "Filled Coffin") {
    prefix = _$.CORPSE_LEVEL;
  }

  for (const line of section) {
    if (line.startsWith(prefix)) {
      item.itemLevel = Number(line.slice(prefix.length));
      return "SECTION_PARSED";
    }
  }
  return "SECTION_SKIPPED";
}

function parseVaalGemName(section: string[], item: ParserState) {
  if (item.category !== ItemCategory.Gem) return "PARSER_SKIPPED";

  // TODO blocked by https://www.pathofexile.com/forum/view-thread/3231236
  if (section.length === 1) {
    let gemName: string | undefined;
    if (ITEM_BY_TRANSLATED("GEM", section[0])) {
      gemName = section[0];
    }
    if (gemName) {
      item.name = ITEM_BY_TRANSLATED("GEM", gemName)![0].refName;
      return "SECTION_PARSED";
    }
  }
  return "SECTION_SKIPPED";
}

function parseGem(section: string[], item: ParsedItem) {
  if (item.category !== ItemCategory.Gem) {
    return "PARSER_SKIPPED";
  }
  if (section[1]?.startsWith(_$.GEM_LEVEL)) {
    // "Level: 20 (Max)"
    item.gemLevel = parseInt(section[1].slice(_$.GEM_LEVEL.length), 10);

    parseQualityNested(section, item);

    return "SECTION_PARSED";
  }
  return "SECTION_SKIPPED";
}

function parseStackSize(section: string[], item: ParsedItem) {
  if (
    item.rarity !== ItemRarity.Normal &&
    item.category !== ItemCategory.Currency
  ) {
    return "PARSER_SKIPPED";
  }
  if (section[0].startsWith(_$.STACK_SIZE)) {
    // Portal Scroll "Stack Size: 2[localized separator]448/40"
    const [value, max] = section[0]
      .slice(_$.STACK_SIZE.length)
      .replace(/[^\d/]/g, "")
      .split("/")
      .map(Number);
    item.stackSize = { value, max };

    return "SECTION_PARSED";
  }
  return "SECTION_SKIPPED";
}

function parseSockets(section: string[], item: ParsedItem) {
  if (section[0].startsWith(_$.SOCKETS)) {
    let sockets = section[0].slice(_$.SOCKETS.length).trimEnd();

    item.sockets = sockets.split("S").length - 1;
    return "SECTION_PARSED";
  }
  return "SECTION_SKIPPED";
}

function parseQualityNested(section: string[], item: ParsedItem) {
  for (const line of section) {
    if (line.startsWith(_$.QUALITY)) {
      // "Quality: +20% (augmented)"
      item.quality = parseInt(line.slice(_$.QUALITY.length), 10);
      break;
    }
  }
}

function parseArmour(section: string[], item: ParsedItem) {
  let isParsed: SectionParseResult = "SECTION_SKIPPED";

  for (const line of section) {
    if (line.startsWith(_$.ARMOUR)) {
      item.armourAR = parseInt(line.slice(_$.ARMOUR.length), 10);
      isParsed = "SECTION_PARSED";
      continue;
    }
    if (line.startsWith(_$.EVASION)) {
      item.armourEV = parseInt(line.slice(_$.EVASION.length), 10);
      isParsed = "SECTION_PARSED";
      continue;
    }
    if (line.startsWith(_$.ENERGY_SHIELD)) {
      item.armourES = parseInt(line.slice(_$.ENERGY_SHIELD.length), 10);
      isParsed = "SECTION_PARSED";
      continue;
    }
    if (line.startsWith(_$.TAG_WARD)) {
      item.armourWARD = parseInt(line.slice(_$.TAG_WARD.length), 10);
      isParsed = "SECTION_PARSED";
      continue;
    }
    if (line.startsWith(_$.BLOCK_CHANCE)) {
      item.armourBLOCK = parseInt(line.slice(_$.BLOCK_CHANCE.length), 10);
      isParsed = "SECTION_PARSED";
      continue;
    }
  }

  if (isParsed === "SECTION_PARSED") {
    parseQualityNested(section, item);
  }

  return isParsed;
}

function parseWeapon(section: string[], item: ParsedItem) {
  let isParsed: SectionParseResult = "SECTION_SKIPPED";

  for (const line of section) {
    if (line.startsWith(_$.CRIT_CHANCE)) {
      item.weaponCRIT = parseFloat(line.slice(_$.CRIT_CHANCE.length));
      isParsed = "SECTION_PARSED";
      continue;
    }
    if (line.startsWith(_$.ATTACK_SPEED)) {
      item.weaponAS = parseFloat(line.slice(_$.ATTACK_SPEED.length));
      isParsed = "SECTION_PARSED";
      continue;
    }
    if (line.startsWith(_$.PHYSICAL_DAMAGE)) {
      item.weaponPHYSICAL = getRollOrMinmaxAvg(
        line
          .slice(_$.PHYSICAL_DAMAGE.length)
          .split("-")
          .map((str) => parseInt(str, 10))
      );
      isParsed = "SECTION_PARSED";
      continue;
    }
    if (line.startsWith(_$.ELEMENTAL_DAMAGE)) {
      item.weaponELEMENTAL = line
        .slice(_$.ELEMENTAL_DAMAGE.length)
        .split(", ")
        .map((element) =>
          getRollOrMinmaxAvg(element.split("-").map((str) => parseInt(str, 10)))
        )
        .reduce((sum, x) => sum + x, 0);

      isParsed = "SECTION_PARSED";
      continue;
    }
  }

  if (isParsed === "SECTION_PARSED") {
    parseQualityNested(section, item);
  }

  return isParsed;
}

function parseLogbookArea(section: string[], item: ParsedItem) {
  if (item.info.refName !== "Expedition Logbook") return "PARSER_SKIPPED";
  if (section.length < 3) return "SECTION_SKIPPED";

  // skip Area, parse Faction
  const faction = STAT_BY_MATCH_STR(section[1]);
  if (!faction) return "SECTION_SKIPPED";

  const areaMods: ParsedModifier[] = [
    {
      info: { tags: [], type: ModifierType.Pseudo },
      stats: [
        {
          stat: faction.stat,
          translation: faction.matcher,
        },
      ],
    },
  ];

  const { modType, lines } = parseModType(section.slice(2));
  for (const line of lines) {
    const found = STAT_BY_MATCH_STR(line);
    if (found && found.stat.ref === "Area contains an Expedition Boss (#)") {
      const roll = found.matcher.value!;
      areaMods.push({
        info: { tags: [], type: modType },
        stats: [
          {
            stat: found.stat,
            translation: found.matcher,
            roll: {
              value: roll,
              min: roll,
              max: roll,
              dp: false,
              unscalable: true,
            },
          },
        ],
      });
    }
  }

  if (!item.logbookAreaMods) {
    item.logbookAreaMods = [areaMods];
  } else {
    item.logbookAreaMods.push(areaMods);
  }

  return "SECTION_PARSED";
}

function parseModifiers(section: string[], item: ParsedItem) {
  if (
    item.rarity !== ItemRarity.Normal &&
    item.rarity !== ItemRarity.Magic &&
    item.rarity !== ItemRarity.Rare &&
    item.rarity !== ItemRarity.Unique
  ) {
    return "PARSER_SKIPPED";
  }

  const recognizedLine = section.find(
    (line) => line.endsWith(ENCHANT_LINE) || isModInfoLine(line)
  );

  if (!recognizedLine) {
    return "SECTION_SKIPPED";
  }

  if (isModInfoLine(recognizedLine)) {
    for (const { modLine, statLines } of groupLinesByMod(section)) {
      const { modType, lines } = parseModType(statLines);
      const modInfo = parseModInfoLine(modLine, modType);
      parseStatsFromMod(lines, item, { info: modInfo, stats: [] });
    }
  } else {
    const { lines } = parseModType(section);
    const modInfo: ModifierInfo = {
      type: ModifierType.Enchant,
      tags: [],
    };
    parseStatsFromMod(lines, item, { info: modInfo, stats: [] });
  }

  return "SECTION_PARSED";
}

function parseMirrored(section: string[], item: ParsedItem) {
  if (section.length === 1) {
    if (section[0] === _$.MIRRORED) {
      item.isMirrored = true;
      return "SECTION_PARSED";
    }
  }
  return "SECTION_SKIPPED";
}

function parseFlask(section: string[], item: ParsedItem) {
  // the purpose of this parser is to "consume" flask buffs
  // so they are not recognized as modifiers

  let isParsed: SectionParseResult = "SECTION_SKIPPED";

  for (const line of section) {
    if (_$.FLASK_CHARGES.test(line)) {
      isParsed = "SECTION_PARSED";
      break;
    }
  }

  if (isParsed) {
    parseQualityNested(section, item);
  }

  return isParsed;
}

function parseSuperior(item: ParserState) {
  if (
    item.rarity === ItemRarity.Normal ||
    (item.rarity === ItemRarity.Magic && item.isUnidentified) ||
    (item.rarity === ItemRarity.Rare && item.isUnidentified) ||
    (item.rarity === ItemRarity.Unique && item.isUnidentified)
  ) {
    if (_$REF.ITEM_SUPERIOR.test(item.name)) {
      item.name = _$REF.ITEM_SUPERIOR.exec(item.name)![1];
    }
  }
}

function parseAreaLevelNested(section: string[], item: ParsedItem) {
  for (const line of section) {
    if (line.startsWith(_$.AREA_LEVEL)) {
      item.areaLevel = Number(line.slice(_$.AREA_LEVEL.length));
      break;
    }
  }
}

function parseAreaLevel(section: string[], item: ParsedItem) {
  if (
    item.info.refName !== "Chronicle of Atzoatl" &&
    item.info.refName !== "Expedition Logbook" &&
    item.info.refName !== "Mirrored Tablet" &&
    item.info.refName !== "Forbidden Tome"
  )
    return "PARSER_SKIPPED";

  parseAreaLevelNested(section, item);

  return item.areaLevel ? "SECTION_PARSED" : "SECTION_SKIPPED";
}

function parseMirroredTablet(section: string[], item: ParsedItem) {
  if (item.info.refName !== "Mirrored Tablet") return "PARSER_SKIPPED";
  if (section.length < 8) return "SECTION_SKIPPED";

  for (const line of section) {
    const found = tryParseTranslation(
      { string: line, unscalable: true },
      ModifierType.Pseudo
    );
    if (found) {
      item.newMods.push({
        info: { tags: [], type: ModifierType.Pseudo },
        stats: [found],
      });
    } else {
      item.unknownModifiers.push({
        text: line,
        type: ModifierType.Pseudo,
      });
    }
  }

  return "SECTION_PARSED";
}

function markupConditionParser(text: string) {
  // ignores state set by <<set:__>>
  // always evaluates first condition to true <if:__>{...}
  // full markup: https://gist.github.com/SnosMe/151549b532df8ea08025a76ae2920ca4

  text = text.replace(/<<set:.+?>>/g, "");
  text = text.replace(
    /<(if:.+?|elif:.+?|else)>{(.+?)}/g,
    (_, type: string, body: string) => {
      return type.startsWith("if:") ? body : "";
    }
  );

  return text;
}

function parseStatsFromMod(
  lines: string[],
  item: ParsedItem,
  modifier: ParsedModifier
) {
  item.newMods.push(modifier);

  const statIterator = linesToStatStrings(lines);
  let stat = statIterator.next();
  while (!stat.done) {
    const parsedStat = tryParseTranslation(stat.value, modifier.info.type);
    if (parsedStat) {
      modifier.stats.push(parsedStat);
      stat = statIterator.next(true);
    } else {
      stat = statIterator.next(false);
    }
  }

  item.unknownModifiers.push(
    ...stat.value.map((line) => ({
      text: line,
      type: modifier.info.type,
    }))
  );
}

/**
 * @deprecated
 */
function transformToLegacyModifiers(item: ParsedItem) {
  item.statsByType = sumStatsByModType(item.newMods);
}

function calcBasePercentile(item: ParsedItem) {
  const info = item.info.unique
    ? ITEM_BY_REF("ITEM", item.info.unique.base)![0].armour
    : item.info.armour;
  if (!info) return;

  // Base percentile is the same for all defences.
  // Using `AR/EV -> ES -> WARD` order to improve accuracy
  // of calculation (larger rolls = more precise).
  if (item.armourAR && info.ar) {
    item.basePercentile = calcPropPercentile(
      item.armourAR,
      info.ar,
      QUALITY_STATS.ARMOUR,
      item
    );
  } else if (item.armourEV && info.ev) {
    item.basePercentile = calcPropPercentile(
      item.armourEV,
      info.ev,
      QUALITY_STATS.EVASION,
      item
    );
  } else if (item.armourES && info.es) {
    item.basePercentile = calcPropPercentile(
      item.armourES,
      info.es,
      QUALITY_STATS.ENERGY_SHIELD,
      item
    );
  } else if (item.armourWARD && info.ward) {
    item.basePercentile = calcPropPercentile(
      item.armourWARD,
      info.ward,
      QUALITY_STATS.WARD,
      item
    );
  }
}

export function removeLinesEnding(
  lines: readonly string[],
  ending: string
): string[] {
  return lines.map((line) =>
    line.endsWith(ending) ? line.slice(0, -ending.length) : line
  );
}
