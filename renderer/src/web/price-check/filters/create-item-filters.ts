import type { ItemFilters } from "./interfaces";
import { ParsedItem, ItemCategory, ItemRarity } from "@/parser";
import { tradeTag } from "../trade/common";
import { BaseType, ITEM_BY_REF } from "@/assets/data";
import { CATEGORY_TO_TRADE_ID } from "../trade/pathofexile-trade";

export const SPECIAL_SUPPORT_GEM = [
  "Empower Support",
  "Enlighten Support",
  "Enhance Support",
];

interface CreateOptions {
  league: string;
  currency: string | undefined;
  collapseListings: "app" | "api";
  activateStockFilter: boolean;
  exact: boolean;
  useEn: boolean;
}

export function createFilters(
  item: ParsedItem,
  opts: CreateOptions
): ItemFilters {
  const filters: ItemFilters = {
    searchExact: {},
    trade: {
      offline: false,
      onlineInLeague: false,
      listed: undefined,
      currency: opts.currency,
      league: opts.league,
      collapseListings: opts.collapseListings,
    },
  };

  if (item.category === ItemCategory.Gem) {
    return createGemFilters(item, filters, opts);
  }
  if (item.stackSize || tradeTag(item)) {
    filters.stackSize = {
      value: item.stackSize?.value || 1,
      disabled: !(
        item.stackSize &&
        item.stackSize.value > 1 &&
        opts.activateStockFilter
      ),
    };
  }
  if (item.category === ItemCategory.Currency) {
    filters.searchExact = {
      baseType: item.info.name,
      baseTypeTrade: t(opts, item.info),
    };
    if (
      item.info.refName === "Mirrored Tablet" ||
      item.info.refName === "Forbidden Tome"
    ) {
      filters.areaLevel = {
        value: item.areaLevel!,
        disabled: false,
      };
    }
    return filters;
  }

  if (item.category === ItemCategory.Waystone) {
    if (item.rarity === ItemRarity.Unique && item.info.unique) {
      filters.searchExact = {
        name: item.info.name,
        nameTrade: t(opts, item.info),
        baseTypeTrade: t(opts, ITEM_BY_REF("ITEM", item.info.unique.base)![0]),
      };
    } else {
      const isOccupiedBy = item.statsByType.some(
        (calc) => calc.stat.ref === "Map is occupied by #"
      );
      filters.searchExact = {
        baseType: item.info.name,
        baseTypeTrade: t(opts, item.info),
      };
      filters.searchRelaxed = {
        category: item.category,
        disabled: !isOccupiedBy,
      };
    }
    filters.waystoneTier = {
      value: item.waystoneTier!,
      disabled: false,
    };
  } else if (item.info.refName === "Expedition Logbook") {
    filters.searchExact = {
      baseType: item.info.name,
      baseTypeTrade: t(opts, item.info),
    };
    filters.areaLevel = {
      value: floorToBracket(item.areaLevel!, [1, 68, 73, 78, 81, 83]),
      disabled: false,
    };
  } else if (item.rarity === ItemRarity.Unique && item.info.unique) {
    filters.searchExact = {
      name: item.info.name,
      nameTrade: t(opts, item.info),
      baseTypeTrade: t(opts, ITEM_BY_REF("ITEM", item.info.unique.base)![0]),
    };
  } else {
    filters.searchExact = {
      baseType: item.info.name,
      baseTypeTrade: t(opts, item.info),
    };
    if (item.category && CATEGORY_TO_TRADE_ID.has(item.category)) {
      let disabled = opts.exact;
      if (
        item.category === ItemCategory.SanctumRelic ||
        item.category === ItemCategory.Charm
      ) {
        disabled = false;
      }
      filters.searchRelaxed = {
        category: item.category,
        disabled: disabled,
      };
    }
  }

  if (item.quality && item.quality >= 20) {
    if (
      item.category === ItemCategory.Flask ||
      item.category === ItemCategory.Tincture
    ) {
      filters.quality = {
        value: item.quality,
        disabled: item.quality <= 20,
      };
    }
  }

  if (item.sockets) {
    filters.sockets = {
      value: item.sockets,
      disabled: false,
    };
  }

  const forAdornedJewel =
    item.rarity === ItemRarity.Magic &&
    // item.isCorrupted && -- let the buyer corrupt
    (item.category === ItemCategory.Jewel ||
      item.category === ItemCategory.AbyssJewel);

  if (
    !item.isUnmodifiable &&
    (item.rarity === ItemRarity.Normal ||
      item.rarity === ItemRarity.Magic ||
      item.rarity === ItemRarity.Rare ||
      item.rarity === ItemRarity.Unique)
  ) {
    filters.corrupted = {
      value: item.isCorrupted,
      exact: forAdornedJewel,
    };
  }

  if (forAdornedJewel) {
    filters.rarity = {
      value: "magic",
    };
  } else if (
    item.rarity === ItemRarity.Normal ||
    item.rarity === ItemRarity.Magic ||
    item.rarity === ItemRarity.Rare
  ) {
    filters.rarity = {
      value: "nonunique",
    };
  }

  if (item.isMirrored) {
    filters.mirrored = { disabled: false };
  }

  if (item.isFoil) {
    filters.foil = { disabled: false };
  }

  if (item.itemLevel) {
    if (
      item.rarity !== ItemRarity.Unique &&
      item.category !== ItemCategory.Waystone &&
      item.category !==
        ItemCategory.Jewel /* https://pathofexile.gamepedia.com/Jewel#Affixes */ &&
      item.category !== ItemCategory.SanctumRelic &&
      item.category !== ItemCategory.Charm &&
      item.info.refName !== "Expedition Logbook"
    ) {
      // TODO limit level by item type
      filters.itemLevel = {
        value: Math.min(item.itemLevel, 86),
        disabled:
          !opts.exact ||
          item.category === ItemCategory.Flask ||
          item.category === ItemCategory.Tincture,
      };
    }

    if (item.rarity === ItemRarity.Unique) {
      if (item.isUnidentified && item.info.refName === "Watcher's Eye") {
        filters.itemLevel = {
          value: item.itemLevel,
          disabled: false,
        };
      }
    }
  }

  if (item.isUnidentified) {
    filters.unidentified = {
      value: true,
      disabled: item.rarity !== ItemRarity.Unique,
    };
  }

  return filters;
}

function createGemFilters(
  item: ParsedItem,
  filters: ItemFilters,
  opts: CreateOptions
) {
  if (!item.info.gem!.transfigured) {
    filters.searchExact = {
      baseType: item.info.name,
      baseTypeTrade: t(opts, item.info),
    };
  } else {
    const normalGem = ITEM_BY_REF("GEM", item.info.gem!.normalVariant!)![0];
    filters.searchExact = {
      baseType: item.info.name,
      baseTypeTrade: t(opts, normalGem),
    };
    filters.discriminator = {
      trade: item.info.tradeDisc!,
    };
  }

  filters.corrupted = {
    value: item.isCorrupted,
  };

  if (item.info.gem!.awakened) {
    filters.gemLevel = {
      value: item.gemLevel!,
      disabled: item.gemLevel! < 5,
    };

    if (item.isCorrupted && item.quality) {
      filters.quality = {
        value: item.quality,
        disabled: item.quality < 20,
      };
    }

    return filters;
  }

  if (SPECIAL_SUPPORT_GEM.includes(item.info.refName)) {
    filters.gemLevel = {
      value: item.gemLevel!,
      disabled: item.gemLevel! < 3,
    };

    if (item.isCorrupted && item.quality) {
      filters.quality = {
        value: item.quality,
        disabled: true,
      };
    }

    return filters;
  }

  if (item.quality) {
    filters.quality = {
      value: item.quality,
      disabled: item.quality < 16,
    };
  }

  filters.gemLevel = {
    value: item.gemLevel!,
    disabled: item.gemLevel! < 19,
  };

  return filters;
}

function t(opts: CreateOptions, info: BaseType) {
  return opts.useEn ? info.refName : info.name;
}

export function floorToBracket(value: number, brackets: readonly number[]) {
  let prev = brackets[0];
  for (const num of brackets) {
    if (num > value) {
      return prev;
    } else {
      prev = num;
    }
  }
  return prev;
}

function ceilToBracket(value: number, brackets: readonly number[]) {
  let prev = brackets[0];
  for (const num of brackets) {
    if (num < value) {
      return prev;
    } else {
      prev = num;
    }
  }
  return prev;
}
