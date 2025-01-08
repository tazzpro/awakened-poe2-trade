import type { ItemCategory } from "@/parser";
import type { StatCalculated } from "@/parser/modifiers";

export interface FilterPreset {
  id: string;
  filters: ItemFilters;
  stats: StatFilter[];
}

interface SearchFilter {
  name?: string;
  nameTrade?: string;
  baseType?: string;
  baseTypeTrade?: string;
  category?: ItemCategory;
}

export interface ItemFilters {
  searchExact: SearchFilter;
  searchRelaxed?: SearchFilter & { disabled: boolean };
  discriminator?: {
    value?: string;
    trade: string;
  };
  rarity?: {
    value: string;
  };
  sockets?: FilterNumeric;
  corrupted?: {
    value: boolean;
    exact?: boolean;
  };
  mirrored?: {
    disabled: boolean;
  };
  foil?: {
    disabled: boolean;
  };
  quality?: FilterNumeric;
  gemLevel?: FilterNumeric;
  waystoneTier?: FilterNumeric;
  itemLevel?: FilterNumeric;
  stackSize?: FilterNumeric;
  unidentified?: {
    value: true;
    disabled: boolean;
  };

  areaLevel?: FilterNumeric;
  trade: {
    offline: boolean;
    onlineInLeague: boolean;
    listed: string | undefined;
    currency: string | undefined;
    league: string;
    collapseListings: "api" | "app";
  };
}

export interface FilterNumeric {
  value: number;
  max?: number | undefined;
  disabled: boolean;
}

export interface StatFilter {
  tradeId: string[];
  statRef: string;
  text: string;
  tag: FilterTag;
  sources: StatCalculated["sources"];
  roll?: {
    value: number;
    min: number | "" | undefined; // NOTE: mutable in UI
    max: number | "" | undefined; // NOTE: mutable in UI
    default: { min: number; max: number };
    bounds?: { min: number; max: number };
    tradeInvert?: boolean;
    dp: boolean;
    isNegated: boolean;
  };
  option?: {
    value: number; // NOTE: mutable in UI
  };
  hidden?: string;
  disabled: boolean; // NOTE: mutable in UI
}

export const INTERNAL_TRADE_IDS = [
  "item.base_percentile",
  "item.armour",
  "item.evasion_rating",
  "item.energy_shield",
  "item.ward",
  "item.block",
  "item.total_dps",
  "item.physical_dps",
  "item.elemental_dps",
  "item.crit",
  "item.aps",
  "item.has_empty_modifier",
] as const;

export type InternalTradeId = (typeof INTERNAL_TRADE_IDS)[number];

export enum ItemHasEmptyModifier {
  Any = 0,
  Prefix = 1,
  Suffix = 2,
}

export enum FilterTag {
  Pseudo = "pseudo",
  Explicit = "explicit",
  Implicit = "implicit",
  Crafted = "crafted",
  Enchant = "enchant",
  Corrupted = "corrupted",
  Variant = "variant",
  Property = "property",
}
