
import { UnitType } from './types';

export const GRID_SIZE = 1000; // Effectively infinite for rendering purposes
export const TILE_SIZE = 32;

// Cooldowns in milliseconds
export const COOLDOWNS: Record<UnitType, number> = {
  [UnitType.PAWN]: 4000,
  [UnitType.ROOK]: 4000,
  [UnitType.KNIGHT]: 4000,
  [UnitType.BISHOP]: 4000,
  [UnitType.QUEEN]: 4000,
  [UnitType.KING]: 4000,
  [UnitType.VAULT]: 0,
};

// Material Score Values
export const MATERIAL_VALUES: Record<UnitType, number> = {
  [UnitType.PAWN]: 1,
  [UnitType.KNIGHT]: 3,
  [UnitType.BISHOP]: 3,
  [UnitType.ROOK]: 5,
  [UnitType.QUEEN]: 9,
  [UnitType.KING]: 0, // King doesn't count for material score
  [UnitType.VAULT]: 50,
};

// Shop Prices (1:1 Ratio with Material Values)
export const SHOP_PRICES: Record<UnitType, number> = {
  [UnitType.PAWN]: 2,
  [UnitType.KNIGHT]: 3,
  [UnitType.BISHOP]: 3,
  [UnitType.ROOK]: 5,
  [UnitType.QUEEN]: 9,
  [UnitType.KING]: 9999, // Cannot buy King
  [UnitType.VAULT]: 9999,
};

// Chess Unicode characters
// Added \uFE0E (Text Variation Selector) to ensure they render as text (colorable) and not Emojis
export const UNIT_ICONS: Record<UnitType, string> = {
  [UnitType.PAWN]: '♟\uFE0E',
  [UnitType.ROOK]: '♜\uFE0E',
  [UnitType.KNIGHT]: '♞\uFE0E',
  [UnitType.BISHOP]: '♝\uFE0E',
  [UnitType.QUEEN]: '♛\uFE0E',
  [UnitType.KING]: '♔\uFE0E',
  [UnitType.VAULT]: '❖\uFE0E',
};

// Zombie Variants (Hollow/Outline versions)
export const ZOMBIE_ICONS: Record<UnitType, string> = {
  [UnitType.PAWN]: '♙\uFE0E',
  [UnitType.ROOK]: '♖\uFE0E',
  [UnitType.KNIGHT]: '♘\uFE0E',
  [UnitType.BISHOP]: '♗\uFE0E',
  [UnitType.QUEEN]: '♕\uFE0E',
  [UnitType.KING]: '♔\uFE0E',
  [UnitType.VAULT]: '❖\uFE0E',
};

// Colors
export const COLORS = {
  HUMAN: '#3b82f6', // Blue 500
  BOT: '#ef4444',   // Red 500
  SELECTION: 'rgba(59, 130, 246, 0.3)',
  SELECTION_BORDER: '#60a5fa',

  // Dark Mode Theme
  GRID: '#131b26',      // Tile B (Deep Sea: Muted Blue-Grey)
  BACKGROUND: '#050a0f', // Tile A (Abyss: Very dark, almost black blue)

  // Light Mode Theme
  LIGHT_GRID: '#e2e8f0', // Tile B (Slate 200)
  LIGHT_BACKGROUND: '#f1f5f9', // Tile A (Slate 100)

  GOLD: '#fbbf24', // Amber 400
  // Solid Opaque Colors for consistency
  VALID_SPAWN: '#39ff14', // Neon Green
  HIGHLIGHT_READY: '#39ff14', // Neon Green
  HIGHLIGHT_COOLDOWN: '#ff073a', // Neon Red

  // Zombie Mode
  ZOMBIE_GREEN: '#39ff14',
};

export const TIER_1_RADIUS = 50; // Tiles
export const BATTLE_ROYALE_RADIUS = 30; // Tiles for auto-resolve
export const MOVE_RANGE_HEAVY = 8; // Tiles

export const FACTION_COLORS = [
  { id: 'red', name: 'Red', hex: '#ef4444', tw: 'bg-red-500' },
  { id: 'orange', name: 'Orange', hex: '#f97316', tw: 'bg-orange-500' },
  { id: 'yellow', name: 'Yellow', hex: '#eab308', tw: 'bg-yellow-500' },
  { id: 'green', name: 'Green', hex: '#22c55e', tw: 'bg-green-500' },
  { id: 'blue', name: 'Blue', hex: '#3b82f6', tw: 'bg-blue-500' },
  { id: 'indigo', name: 'Indigo', hex: '#6366f1', tw: 'bg-indigo-500' },
  { id: 'violet', name: 'Violet', hex: '#a855f7', tw: 'bg-purple-500' }
];