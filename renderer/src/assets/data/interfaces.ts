import type { ItemCategory } from "@/parser";

export interface StatMatcher {
  string: string;
  advanced?: string;
  negate?: true;
  value?: number;
  distilled?: string; // Amulet anointment
}

export enum StatBetter {
  NegativeRoll = -1,
  PositiveRoll = 1,
  NotComparable = 0,
}

export interface Stat {
  ref: string;
  dp?: true;
  matchers: StatMatcher[];
  better: StatBetter;
  fromAreaMods?: true;
  anointments?: Array<{ roll: number; oils: string }>; // Ring anointments
  trade: {
    inverted?: true;
    option?: true;
    ids: {
      [type: string]: string[];
    };
  };
}

export interface DropEntry {
  query: string[];
  items: string[];
}

export interface BaseType {
  name: string;
  refName: string;
  namespace: "UNIQUE" | "ITEM" | "GEM";
  icon: string;
  w?: number;
  h?: number;
  tradeTag?: string;
  tradeDisc?: string;
  disc?: {
    propAR?: true;
    propEV?: true;
    propES?: true;
    hasImplicit?: { ref: Stat["ref"] };
    hasExplicit?: { ref: Stat["ref"] };
    sectionText?: string;
    waystoneTier?: "W" | "Y" | "R";
  };
  // extra info
  craftable?: {
    category: ItemCategory;
    corrupted?: true;
    uniqueOnly?: true;
  };
  unique?: {
    base: BaseType["refName"];
    fixedStats?: Array<Stat["ref"]>;
  };
  map?: {
    screenshot?: string;
  };
  gem?: {
    vaal?: true;
    awakened?: true;
    transfigured?: true;
    normalVariant?: BaseType["refName"];
  };
  armour?: {
    ar?: [min: number, max: number];
    ev?: [min: number, max: number];
    es?: [min: number, max: number];
    ward?: [min: number, max: number];
  };
}

export interface TranslationDict {
  RARITY_NORMAL: string;
  RARITY_MAGIC: string;
  RARITY_RARE: string;
  RARITY_UNIQUE: string;
  RARITY_GEM: string;
  RARITY_CURRENCY: string;
  RARITY_QUEST: string;
  WAYSTONE_TIER: string;
  RARITY: string;
  ITEM_CLASS: string;
  ITEM_LEVEL: string;
  CORPSE_LEVEL: string;
  GEM_LEVEL: string;
  STACK_SIZE: string;
  SOCKETS: string;
  QUALITY: string;
  PHYSICAL_DAMAGE: string;
  ELEMENTAL_DAMAGE: string;
  CRIT_CHANCE: string;
  ATTACK_SPEED: string;
  ARMOUR: string;
  EVASION: string;
  ENERGY_SHIELD: string;
  TAG_WARD: string;
  BLOCK_CHANCE: string;
  CORRUPTED: string;
  UNIDENTIFIED: string;
  ITEM_SUPERIOR: RegExp;
  FLASK_CHARGES: RegExp;
  CANNOT_USE_ITEM: string;
  QUALITY_ANOMALOUS: RegExp;
  QUALITY_DIVERGENT: RegExp;
  QUALITY_PHANTASMAL: RegExp;
  AREA_LEVEL: string;
  MIRRORED: string;
  MODIFIER_LINE: RegExp;
  PREFIX_MODIFIER: string;
  SUFFIX_MODIFIER: string;
  UNSCALABLE_VALUE: string;
  CORRUPTED_IMPLICIT: string;
  MODIFIER_INCREASED: RegExp;
  FOIL_UNIQUE: string;
  UNMODIFIABLE: string;
  // ---
  CHAT_SYSTEM: RegExp;
  CHAT_TRADE: RegExp;
  CHAT_GLOBAL: RegExp;
  CHAT_PARTY: RegExp;
  CHAT_GUILD: RegExp;
  CHAT_WHISPER_TO: RegExp;
  CHAT_WHISPER_FROM: RegExp;
  CHAT_WEBTRADE_GEM: RegExp;
}
