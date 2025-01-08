import type { ModifierType, StatCalculated } from "./modifiers";
import type { ParsedModifier } from "./advanced-mod-desc";
import type { BaseType } from "@/assets/data";
import { ItemCategory } from "./meta";

export enum ItemRarity {
  Normal = "Normal",
  Magic = "Magic",
  Rare = "Rare",
  Unique = "Unique",
}

export interface ParsedItem {
  rarity?: ItemRarity;
  itemLevel?: number;
  armourAR?: number;
  armourEV?: number;
  armourES?: number;
  armourWARD?: number;
  armourBLOCK?: number;
  basePercentile?: number;
  weaponCRIT?: number;
  weaponAS?: number;
  weaponPHYSICAL?: number;
  weaponELEMENTAL?: number;
  waystoneTier?: number;
  gemLevel?: number;
  areaLevel?: number;
  quality?: number;
  sockets?: number;
  stackSize?: { value: number; max: number };
  isUnidentified: boolean;
  isCorrupted: boolean;
  isUnmodifiable?: boolean;
  isMirrored?: boolean;
  logbookAreaMods?: ParsedModifier[][];
  isFoil?: boolean;
  statsByType: StatCalculated[];
  newMods: ParsedModifier[];
  unknownModifiers: Array<{
    text: string;
    type: ModifierType;
  }>;
  category?: ItemCategory;
  info: BaseType;
  rawText: string;
}

export function createVirtualItem(
  props: Partial<ParsedItem> & Pick<ParsedItem, "info">
): ParsedItem {
  return {
    ...props,
    isUnidentified: props.isUnidentified ?? false,
    isCorrupted: props.isCorrupted ?? false,
    newMods: props.newMods ?? [],
    statsByType: props.statsByType ?? [],
    unknownModifiers: props.unknownModifiers ?? [],
    rawText: "VIRTUAL_ITEM",
  };
}
