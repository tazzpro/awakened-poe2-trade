export enum ItemCategory {
  Waystone = "Waystone",
  Helmet = "Helmet",
  BodyArmour = "Body Armour",
  Gloves = "Gloves",
  Boots = "Boots",
  Shield = "Shield",
  Amulet = "Amulet",
  Belt = "Belt",
  Ring = "Ring",
  Flask = "Flask",
  AbyssJewel = "Abyss Jewel",
  Jewel = "Jewel",
  Quiver = "Quiver",
  Claw = "Claw",
  Bow = "Bow",
  Sceptre = "Sceptre",
  Wand = "Wand",
  Staff = "Staff",
  Warstaff = "Warstaff",
  Dagger = "Dagger",
  RuneDagger = "Rune Dagger",
  OneHandedAxe = "One-Handed Axe",
  TwoHandedAxe = "Two-Handed Axe",
  OneHandedMace = "One-Handed Mace",
  TwoHandedMace = "Two-Handed Mace",
  OneHandedSword = "One-Handed Sword",
  TwoHandedSword = "Two-Handed Sword",
  Gem = "Gem",
  Currency = "Currency",
  Sentinel = "Sentinel",
  SanctumRelic = "Sanctum Relic",
  Tincture = "Tincture",
  Charm = "Charm",
}

export const WEAPON_ONE_HANDED_MELEE = new Set([
  ItemCategory.OneHandedAxe,
  ItemCategory.OneHandedMace,
  ItemCategory.OneHandedSword,
  ItemCategory.Claw,
  ItemCategory.Dagger,
  ItemCategory.RuneDagger,
  ItemCategory.Sceptre,
]);

export const WEAPON_ONE_HANDED = new Set([
  ItemCategory.Wand,
  ...WEAPON_ONE_HANDED_MELEE,
]);

export const WEAPONE_TWO_HANDED_MELEE = new Set([
  ItemCategory.TwoHandedAxe,
  ItemCategory.TwoHandedMace,
  ItemCategory.TwoHandedSword,
  ItemCategory.Staff,
  ItemCategory.Warstaff,
]);

export const WEAPON = new Set([
  ItemCategory.Bow,
  ...WEAPON_ONE_HANDED,
  ...WEAPONE_TWO_HANDED_MELEE,
]);

export const ARMOUR = new Set([
  ItemCategory.BodyArmour,
  ItemCategory.Boots,
  ItemCategory.Gloves,
  ItemCategory.Helmet,
  ItemCategory.Shield,
]);

export const ACCESSORY = new Set([
  ItemCategory.Amulet,
  ItemCategory.Belt,
  ItemCategory.Ring,
  ItemCategory.Quiver,
]);
