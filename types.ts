
export enum UnitType {
  PAWN = 'PAWN',
  ROOK = 'ROOK',
  KNIGHT = 'KNIGHT',
  BISHOP = 'BISHOP',
  QUEEN = 'QUEEN',
  KING = 'KING',
  VAULT = 'VAULT' // New Event Unit
}

export enum TerrainType {
  GRASS = 'GRASS',
  WALL = 'WALL',
  FOREST = 'FOREST',
  WATER = 'WATER',
  SAND = 'SAND',
  SNOW = 'SNOW',
}

export interface Coords {
  x: number;
  y: number;
}

export interface Coin {
  id: string;
  x: number;
  y: number;
  value: number;
}

export interface Unit {
  id: string;
  ownerId: string;
  type: UnitType;
  x: number;
  y: number;
  lastMoveTime: number; // Timestamp
  hp: number; // For RTS elements (though chess is typically 1-hit kill, we keep this for structure)
  isDead: boolean;
  isZombie?: boolean; // ZOMBIE MODE SPECIFIC
}

export enum AIState {
  SIEGE = 'SIEGE',
  VENDETTA = 'VENDETTA',
  SCAVENGE = 'SCAVENGE',
  PANIC = 'PANIC',
  IDLE = 'IDLE' // Added for Turtles
}

export enum BotPersonality {
  NONE = 'NONE',
  AGGRESSOR = 'AGGRESSOR', // Biased toward Human
  TURTLE = 'TURTLE',       // Camps until forced
  SCAVENGER = 'SCAVENGER', // Loves coins
  AVENGER = 'AVENGER'      // Infinite Vendetta
}

export type ChatCategory = 'KILL' | 'DEATH' | 'VENDETTA' | 'WINNING' | 'LOOT' | 'REPLY_TO_KILL' | 'REPLY_TO_DEATH' | 'REPLY_GENERIC' | 'HUNT' | 'STAGNATION';

export interface Player {
  id: string;
  isHuman: boolean;
  color: string;
  centerX: number; // For Tier 2 calculation
  centerY: number;
  isEliminated: boolean;
  units: string[]; // Array of Unit IDs
  credits: number;
  totalCollected: number; // Total credits collected from coins
  materialScore: number;
  peakMaterial: number; // Highest material score achieved
  kills: number;
  kingsKilled: number;
  lastScoreTime: number;

  // Combat Tracking
  lastCombatTime: number; // For Stagnation Check

  // AI State Fields
  aiState?: AIState;
  aiTargetId?: string | null;
  lastAiUpdate?: number;
  lastActionUpdate?: number; // Optimization: Throttle movement logic
  lastDamageTime?: number;
  lastAttackerId?: string | null;
  lastRegroupTime?: number;

  // AI Action Timer (Step 1)
  lastActionTime: number;
  actionDelay: number;

  // Step 3: Tactical Mode
  tacticalMode?: 'COMBAT' | 'MARCH';

  // Step 5: Wide Front Tactics
  lastMovedLane: number; // -1 (Left), 0 (Center), 1 (Right) relative to target

  // Step 6: Meat Grinder Tuning
  combatStartTime: number; // When did we start fighting the current target?
  totalWarActive: boolean; // If true, disable safety checks and force captures
  lastTargetId?: string | null; // To detect target switching

  // Director / Stalemate Fields
  siegeStartTime?: number; // When did we start sieging the current target?
  currentSiegeTargetId?: string | null;
  isHunting?: boolean; // Director Override: Forces focus on Human

  // Diplomacy Overhaul
  allies: string[]; // List of allied Player IDs
  enemies: string[]; // List of enemy Player IDs (War)
  diplomacyState: 'NEUTRAL' | 'ALLY' | 'WAR'; // Current perceived state

  // Step 4: Personality & Chat
  personality: BotPersonality;
  chatMessage: string | null;
  chatTimer: number; // ms remaining
  lastChatType?: ChatCategory; // To allow other bots to respond contextually
  lastSocialCheck?: number; // Optimization: Throttle social interactions
  lastChatTime?: number; // Optimization: Global chat cooldown per bot
}

export interface LeaderboardEntry {
  playerId: string;
  isHuman: boolean;
  color: string;
  score: number;
  rank: number;
}

export interface GameOverStats {
  isWin: boolean;
  rank: number;
  kills: number;
  kingsKilled: number;
  coins: number; // Total value of coins collected
  timeSurvived: number; // Seconds
  finalScore: number;
  peakMaterial: number;
  killerName?: string;
  killerType?: UnitType;
  killerColor?: string;
  isResignation?: boolean;
}

export interface GameStats {
  playersRemaining: number;
  fps: number;
  gameTime: number;
  leaderboard?: LeaderboardEntry[];
  credits: number;
  gameOver?: GameOverStats | null;
  peaceTimer: number; // MS remaining for global armistice
  wave?: number; // ZOMBIE MODE
  nextWaveTime?: number; // ZOMBIE MODE
  vaultPos?: Coords | null; // GLOBAL EVENT
}

export interface GameConfig {
  humanColor: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  gameMode: 'STANDARD' | 'BULLET' | 'SINGULARITY' | 'DIPLOMACY' | 'ZOMBIES' | 'SANDBOX' | 'ADVENTURE';
  mapType?: 'EMPTY' | 'FOREST' | 'DESERT' | 'FROZEN';
}

export type SelectionBox = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
} | null;

export enum GameEventType {
  ATTACK = 'ATTACK',
  DEATH = 'DEATH',
  CONVERSION = 'CONVERSION',
  COIN_PICKUP = 'COIN_PICKUP',
  SPAWN = 'SPAWN',
  VAULT_SPAWN = 'VAULT_SPAWN'
}

export interface GameEvent {
  type: GameEventType;
  x: number;
  y: number;
  metadata?: any; // e.g., color of dying unit
}

export const TILE_SIZE = 32;
