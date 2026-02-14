import { Unit, Player, UnitType, Coords, GameEvent, GameEventType, LeaderboardEntry, Coin, GameOverStats, GameConfig, AIState, BotPersonality, ChatCategory } from '../types';
import { COOLDOWNS, MOVE_RANGE_HEAVY, COLORS, MATERIAL_VALUES, SHOP_PRICES } from '../constants';
import { IGameMode } from '../logic/IGameMode';
import { StandardMode } from '../logic/StandardMode';
import { ZombieMode } from '../logic/ZombieMode';
import { DiplomacyMode } from '../logic/DiplomacyMode';
import { SandboxMode } from '../logic/SandboxMode';
import { WorldGenerator, TerrainTile } from './WorldGenerator';

// --- DIFFICULTY PROFILES ---
// NOTE: Bot-vs-bot fights always use 50ms (line ~897). These delays only apply when fighting the human.
const DIFFICULTY_PROFILES = {
    RECRUIT: { // EASY (Relaxed Learning Mode)
        reactionDelay: 2500,        // 2.5s delay when targeting player
        visionRadius: 20,
        playerTargetBonus: 0,       // Bots rarely prioritize player
        enableSafetyChecks: false,
        enableMinimax: false,
        directorInterval: 0,        // No director pressure
        personalityWeights: { aggressor: 0, turtle: 0.95, scavenger: 0.05, avenger: 0 }
    },
    CADET: { // MEDIUM (Formerly Easy)
        reactionDelay: 1500,        // 1.5s delay when targeting player
        visionRadius: 30,
        playerTargetBonus: 1000,    // Moderate targeting
        enableSafetyChecks: false,
        enableMinimax: false,
        directorInterval: 60000,    // Minimal director pressure
        personalityWeights: { aggressor: 0.2, turtle: 0.7, scavenger: 0.1, avenger: 0 }
    },
    TACTICAL: { // HARD (Formerly Medium)
        reactionDelay: 600,         // 0.6s delay when targeting player
        visionRadius: 60,
        playerTargetBonus: 5000,
        enableSafetyChecks: true,
        enableMinimax: false,
        directorInterval: 30000,
        personalityWeights: { aggressor: 0.4, turtle: 0.4, scavenger: 0, avenger: 0.2 }
    }
};

const ZOMBIE_TEAM_ID = 'ZOMBIES';
const VAULT_TEAM_ID = 'NEUTRAL_VAULT';

const CHAT_DB: Record<ChatCategory, Partial<Record<BotPersonality, string[]>>> = {
    KILL: {
        [BotPersonality.AGGRESSOR]: ["Sit down.", "Ez.", "Next?", "Donated.", "Weak.", "Deleted.", "Disrespect.", "Get good.", "Not enough APM.", "Trash.", "Stay dead."],
        [BotPersonality.AVENGER]: ["Justice.", "For the cause.", "One less.", "Executed.", "Judgment.", "The list grows shorter.", "Target eliminated."],
        [BotPersonality.TURTLE]: ["Stay back!", "Self defense!", "Don't push me.", "I warned you.", "Back off.", "My space.", "Leave me alone."],
        [BotPersonality.SCAVENGER]: ["Mine now.", "Thanks for the coins.", "Payday!", "Nice loot.", "Profitable.", "Give me that.", "Scrap metal."]
    },
    DEATH: {
        [BotPersonality.AGGRESSOR]: ["Lag.", "Lucky shot.", "Reported.", "No way.", "Broken game.", "Stream sniping?", "Rigged.", "1v1 me.", "Wow."],
        [BotPersonality.AVENGER]: ["I will return.", "This isn't over.", "Vengeance...", "Remember me.", "A minor setback.", "My brothers will know.", "Curse you."],
        [BotPersonality.TURTLE]: ["Ouch.", "Why?", "I was peaceful!", "Nooo!", "Help!", "Unfair.", "I hate this.", "Too crowded."],
        [BotPersonality.SCAVENGER]: ["My coins...", "Broke again.", "Not worth it.", "Bankruptcy.", "Just my luck.", "Dropped it all.", "Bad investment."]
    },
    VENDETTA: { // Getting hit
        [BotPersonality.AGGRESSOR]: ["You're dead.", "Big mistake.", "Oh it's on.", "Target locked.", "You want some?", "Focusing you.", "Watch your back."],
        [BotPersonality.AVENGER]: ["I won't forget.", "Marked.", "You are chosen.", "Fate sealed.", "Name recorded.", "Pray.", "Vendetta."],
        [BotPersonality.TURTLE]: ["Stop it!", "Go away!", "Help!", "Why me?", "Please stop.", "I'm just chilling!", "Cease fire!"],
        [BotPersonality.SCAVENGER]: ["Hey, my money!", "Costly mistake.", "Don't touch the merch.", "Risking it?", "I'm busy!", "Rude."]
    },
    WINNING: { // High rank
        [BotPersonality.AGGRESSOR]: ["King of the Hill.", "Can't touch this.", "I am inevitable.", "Top 1 soon.", "Look at the scoreboard.", "Dominating.", "Godlike."],
        [BotPersonality.AVENGER]: ["The purge continues.", "Cleansing the board.", "Ascending.", "They will fear us.", "Unstoppable."],
        [BotPersonality.TURTLE]: ["Fortress secure.", "Holding the line.", "Try to breach this.", "Impenetrable.", "Safe here."],
        [BotPersonality.SCAVENGER]: ["So rich.", "Look at this stash.", "Economy booming.", "Capitalism wins.", "Rolling in it."]
    },
    LOOT: { // Picking up coins
        [BotPersonality.SCAVENGER]: ["Shinies.", "Ooh, a piece of candy.", "Stonks.", "Investment.", "Cha-ching.", "Adding to collection."],
        [BotPersonality.AGGRESSOR]: ["Fuel.", "More power.", "Funding the war."],
        [BotPersonality.TURTLE]: ["Supplies.", "Rations.", "For the bunker."]
    },
    HUNT: {
        [BotPersonality.AGGRESSOR]: ["Found you.", "Stop hiding.", "Hunting party inbound.", "There is no escape.", "I see you.", "Playtime is over."],
        [BotPersonality.AVENGER]: ["You cannot hide from judgment.", "I have located the sinner.", "Closing in.", "Your time is up."],
        [BotPersonality.TURTLE]: ["I must clear this area.", "Moving out.", "You're too close."],
        [BotPersonality.SCAVENGER]: ["You look valuable.", "Time to collect.", "Target acquired."]
    },
    STAGNATION: {
        [BotPersonality.AGGRESSOR]: ["Too quiet.", "Searching for targets.", "Moving out.", "Bored. attacking now."],
        [BotPersonality.AVENGER]: ["The hunt begins.", "Seeking the guilty.", "Patrolling.", "No place to hide."],
        [BotPersonality.TURTLE]: ["Forced to move.", "Expanding perimeter.", "Scouting ahead.", "Unsafe here."],
        [BotPersonality.SCAVENGER]: ["Looking for loot.", "New hunting grounds.", "Moving shop.", "Any coins nearby?"]
    },
    REPLY_TO_KILL: {
        [BotPersonality.AGGRESSOR]: ["You're next.", "Quiet, you.", "Show off.", "I could do better.", "Lucky.", "Don't get cocky."],
        [BotPersonality.AVENGER]: ["Violence breeds violence.", "A necessary evil.", "Watch your back.", "Blood for blood."],
        [BotPersonality.TURTLE]: ["Glad it wasn't me.", "Please ignore me.", "Scary.", "Brutal.", "Staying out of this."],
        [BotPersonality.SCAVENGER]: ["Did he drop loot?", "Can I have the body?", "Any coins left?", "Nice kill, gimme loot."]
    },
    REPLY_TO_DEATH: {
        [BotPersonality.AGGRESSOR]: ["Ha!", "Sit.", "Cya.", "L.", "Pathetic.", "Finally."],
        [BotPersonality.AVENGER]: ["Rest in peace.", "Another fallen.", "War is hell.", "You fought well."],
        [BotPersonality.TURTLE]: ["Oh no.", "Is it safe?", "They're dying everywhere.", "Hiding now."],
        [BotPersonality.SCAVENGER]: ["Dibs!", "Loot drop!", "Mine!", "Running to body.", "Free stuff."]
    },
    REPLY_GENERIC: {
        [BotPersonality.AGGRESSOR]: ["Shut up.", "Whatever.", "Who asked?", "Keep talking."],
        [BotPersonality.AVENGER]: ["Focus.", "The end is near.", "Prepare yourself."],
        [BotPersonality.TURTLE]: ["Hi.", "Friendly?", "Just passing through."],
        [BotPersonality.SCAVENGER]: ["Trade?", "Got money?", "Buying gf."]
    }
};

export class GameEngine {
    units: Map<string, Unit>;
    coins: Map<string, Coin>;
    players: Map<string, Player>;
    humanId: string;
    positionMap: Map<string, string>;
    eventQueue: GameEvent[];
    terrainMap: Map<string, TerrainTile>;

    lastRealTime: number;
    virtualTime: number;
    paused: boolean;

    gameTime: number;
    gameStartTime: number;


    lastHumanCombatTime: number;

    // DIPLOMACY STATE
    peaceTimer: number; // MS remaining for global armistice

    // ZOMBIE STATE
    wave: number = 0;
    waveTimer: number = 0; // MS until next wave

    // GOLD RUSH STATE
    activeVaultId: string | null = null;
    nextVaultTimer: number = 0;

    humanKiller: { name: string, type: UnitType, color: string } | null;
    cachedGameOverStats: GameOverStats | null;

    config: GameConfig;

    isAttractMode: boolean;
    public timeMultiplier: number = 1;
    activeMode: IGameMode = new StandardMode();
    private attractSeed: number;

    // Track resignation
    private isResigned: boolean = false;

    // AI Load Balancing
    private aiUpdateIndex: number = 0;
    private directorCheckIndex: number = 0;
    private lastDirectorCheck: number = 0;

    // THE DIRECTOR (Game Pacing Manager)
    directorState = {
        phase: 'CHAOS' as 'CHAOS' | 'HUNT' | 'CONVERGENCE' | 'SUDDEN_DEATH',
        infiniteVision: false,
        centerGravity: false,
        totalWar: false,
        lastKillTime: 0
    };

    constructor(config: GameConfig = { humanColor: COLORS.HUMAN, difficulty: 'Medium', gameMode: 'STANDARD' }) {
        this.config = config;
        this.units = new Map();
        this.coins = new Map();
        this.players = new Map();
        this.positionMap = new Map();
        this.terrainMap = new Map();
        this.eventQueue = [];
        this.humanId = 'player-0';

        const now = Date.now();
        this.lastRealTime = now;
        this.virtualTime = now;
        this.paused = false;

        this.gameTime = now;
        this.gameStartTime = now;

        this.lastDirectorCheck = now;
        this.lastHumanCombatTime = now;

        // Diplomacy Default
        this.peaceTimer = 0;

        this.humanKiller = null;
        this.cachedGameOverStats = null;

        this.isAttractMode = false;
        this.attractSeed = 54321;
        this.isResigned = false;
    }

    // Dynamic getter for players remaining
    get playersRemaining(): number {
        let count = 0;
        for (const p of this.players.values()) {
            // In Zombie mode, the Zombie team counts as a player until eliminated (if ever)
            // But typically we care about how many 'competitors' are left.
            // For now, simple count of non-eliminated players is correct.
            if (!p.isEliminated) count++;
        }
        return count;
    }

    public random(): number {
        if (this.isAttractMode) {
            this.attractSeed = (this.attractSeed * 9301 + 49297) % 233280;
            return this.attractSeed / 233280;
        }
        return Math.random();
    }

    get currentTime(): number {
        return this.virtualTime;
    }

    setPaused(paused: boolean) {
        this.paused = paused;
        if (!paused) {
            this.lastRealTime = Date.now();
        }
    }

    public getUnitCooldown(type: UnitType): number {
        const baseCooldown = COOLDOWNS[type];
        if (this.config.gameMode === 'BULLET') {
            // 50% Cooldowns (Double Speed)
            return baseCooldown / 2;
        }
        return baseCooldown;
    }

    public getDistanceBetweenPlayers(p1Id: string, p2Id: string): number {
        const p1 = this.players.get(p1Id);
        const p2 = this.players.get(p2Id);
        if (!p1 || !p2) return Infinity;
        return Math.hypot(p1.centerX - p2.centerX, p1.centerY - p2.centerY);
    }

    public isAlly(p1Id: string, p2Id: string): boolean {
        if (this.config.gameMode !== 'DIPLOMACY') return false;
        const p1 = this.players.get(p1Id);
        if (!p1) return false;
        return p1.allies.includes(p2Id);
    }

    public isEnemy(p1Id: string, p2Id: string): boolean {
        if (this.config.gameMode !== 'DIPLOMACY') return true; // Standard = everyone is enemy
        const p1 = this.players.get(p1Id);
        if (!p1) return false;
        return p1.enemies.includes(p2Id);
    }

    private isFightingHuman(bot: Player, now: number): boolean {
        if (bot.isHuman) return false;
        if (bot.aiTargetId === this.humanId) return true;
        if (bot.lastAttackerId === this.humanId && (now - (bot.lastDamageTime || 0) < 5000)) return true;
        return false;
    }

    public formAlliance(p1Id: string, p2Id: string) {
        const p1 = this.players.get(p1Id);
        const p2 = this.players.get(p2Id);
        if (!p1 || !p2 || p1.isEliminated || p2.isEliminated) return;

        if (this.getDistanceBetweenPlayers(p1Id, p2Id) > 80) return;

        const newAllianceSet = new Set<string>();
        newAllianceSet.add(p1.id);
        newAllianceSet.add(p2.id);
        p1.allies.forEach(id => newAllianceSet.add(id));
        p2.allies.forEach(id => newAllianceSet.add(id));

        const newAllianceArray = Array.from(newAllianceSet);

        newAllianceArray.forEach(memberId => {
            const member = this.players.get(memberId);
            if (!member) return;
            member.allies = newAllianceArray.filter(id => id !== memberId);
            member.enemies = member.enemies.filter(enemyId => !newAllianceSet.has(enemyId));
            member.diplomacyState = 'ALLY';
        });

        this.triggerKingFlash(p1Id, '#00ffff');
        this.triggerKingFlash(p2Id, '#00ffff');
    }

    public declareWar(attackerId: string, victimId: string) {
        if (this.config.gameMode !== 'DIPLOMACY') return;

        const attacker = this.players.get(attackerId);
        const victim = this.players.get(victimId);
        if (!attacker || !victim) return;

        if (this.getDistanceBetweenPlayers(attackerId, victimId) > 80) return;

        if (attacker.enemies.includes(victimId)) return;

        const aggressorPack = [attacker.id, ...attacker.allies];
        const defenderPack = [victim.id, ...victim.allies];

        aggressorPack.forEach(aggId => {
            const agg = this.players.get(aggId);
            if (agg) {
                const newEnemies = defenderPack.filter(defId => !agg.enemies.includes(defId) && defId !== aggId);
                agg.enemies.push(...newEnemies);
                agg.diplomacyState = 'WAR';
                if (!agg.isHuman && agg.aiState === AIState.IDLE) {
                    agg.aiState = AIState.VENDETTA;
                    agg.aiTargetId = victimId;
                }
            }
        });

        defenderPack.forEach(defId => {
            const def = this.players.get(defId);
            if (def) {
                const newEnemies = aggressorPack.filter(aggId => !def.enemies.includes(aggId) && aggId !== defId);
                def.enemies.push(...newEnemies);
                def.diplomacyState = 'WAR';
                if (!def.isHuman && def.aiState === AIState.IDLE) {
                    def.aiState = AIState.VENDETTA;
                    def.aiTargetId = attackerId;
                }
            }
        });

        this.triggerKingFlash(attackerId, '#ef4444');
        this.triggerKingFlash(victimId, '#ef4444');
    }

    public handleAllianceRequest(botId: string, requesterId: string) {
        if (this.config.gameMode !== 'DIPLOMACY') return;
        const bot = this.players.get(botId);
        const requester = this.players.get(requesterId);

        if (!bot || !requester || bot.isEliminated || requester.isEliminated) return;

        if (this.getDistanceBetweenPlayers(botId, requesterId) > 80) {
            if (bot.isHuman) return;
            return;
        }

        if (bot.isHuman) return;

        const mergedSize = 1 + bot.allies.length + 1 + requester.allies.length;
        if (mergedSize > 10) {
            this.botSpeak(bot, 'REPLY_GENERIC', true);
            bot.chatMessage = "Group too big.";
            this.triggerKingFlash(botId, '#ef4444');
            return;
        }

        let accept = false;
        const botArmySize = bot.units.filter(u => !this.units.get(u)?.isDead).length;

        if (this.peaceTimer > 0) accept = Math.random() < 0.9;
        else if (botArmySize < 5) accept = Math.random() < 0.8;

        if (!accept) {
            if (bot.personality === BotPersonality.TURTLE) {
                accept = Math.random() < 0.5;
            } else if (bot.personality === BotPersonality.AGGRESSOR) {
                accept = Math.random() < 0.1;
            } else {
                accept = Math.random() < 0.25;
            }
        }

        if (accept) {
            this.formAlliance(bot.id, requester.id);
            bot.chatMessage = "Alliance accepted.";
            bot.chatTimer = 3000;
            bot.lastChatType = 'REPLY_GENERIC';
        } else {
            this.triggerKingFlash(botId, '#ef4444');
            const rejects = ["No.", "Weak.", "Not interested.", "Go away."];
            bot.chatMessage = rejects[Math.floor(Math.random() * rejects.length)];
            bot.chatTimer = 3000;
            bot.lastChatType = 'REPLY_GENERIC';
        }
    }

    public breakAlliance(p1Id: string, p2Id: string) {
        this.declareWar(p1Id, p2Id);
    }

    private triggerKingFlash(playerId: string, color: string) {
        const player = this.players.get(playerId);
        if (!player) return;
        const kingId = player.units.find(uid => this.units.get(uid)?.type === UnitType.KING);
        if (kingId) {
            const king = this.units.get(kingId);
            if (king) {
                this.eventQueue.push({
                    type: GameEventType.CONVERSION,
                    x: king.x,
                    y: king.y,
                    metadata: { color: color }
                });
            }
        }
    }

    private updateDiplomacy(bot: Player, now: number) {
        if (this.config.gameMode !== 'DIPLOMACY') return;
        if (bot.isHuman || bot.isEliminated) return;
        if (now - (bot.lastAiUpdate || 0) < 2000) return;

        const kingId = bot.units.find(u => this.units.get(u)?.type === UnitType.KING);
        if (!kingId) return;
        const king = this.units.get(kingId);
        if (!king) return;

        const nearbyPlayers = new Set<string>();
        for (let dx = -15; dx <= 15; dx += 5) {
            for (let dy = -15; dy <= 15; dy += 5) {
                const tid = this.positionMap.get(`${king.x + dx},${king.y + dy}`);
                if (tid) {
                    const u = this.units.get(tid);
                    if (u && u.ownerId !== bot.id) {
                        nearbyPlayers.add(u.ownerId);
                    }
                }
            }
        }

        nearbyPlayers.forEach(otherId => {
            const other = this.players.get(otherId);
            if (!other || other.isEliminated) return;

            if (bot.allies.includes(otherId) || bot.enemies.includes(otherId)) return;

            if (this.peaceTimer > 0) {
                if (Math.random() < 0.02) {
                    this.handleAllianceRequest(other.id, bot.id);
                }
            } else {
                if (bot.personality === BotPersonality.AGGRESSOR) {
                    if (Math.random() < 0.01) this.declareWar(bot.id, other.id);
                } else if (bot.personality === BotPersonality.TURTLE) {
                    if (Math.random() < 0.02) this.handleAllianceRequest(other.id, bot.id);
                } else {
                    if (Math.random() < 0.005) this.declareWar(bot.id, other.id);
                }
            }
        });
    }

    private getDifficultyProfile() {
        const base = this.config.difficulty === 'Easy' ? DIFFICULTY_PROFILES.RECRUIT :
            this.config.difficulty === 'Hard' ? DIFFICULTY_PROFILES.TACTICAL :
                DIFFICULTY_PROFILES.CADET; // Medium

        if (this.config.gameMode === 'BULLET') {
            return {
                ...base,
                playerTargetBonus: 10000,
                visionRadius: 200,
                directorInterval: 10000,
                reactionDelay: 100 // Bullet speed
            };
        }
        return base;
    }

    private getChatLine(category: ChatCategory, personality: BotPersonality): string | null {
        const categoryGroup = CHAT_DB[category];
        if (!categoryGroup) return null;

        let lines = categoryGroup[personality];
        if (!lines) {
            lines = categoryGroup[BotPersonality.AGGRESSOR];
        }

        if (!lines || lines.length === 0) return null;
        return lines[Math.floor(this.random() * lines.length)];
    }

    private botSpeak(bot: Player, category: ChatCategory, forced: boolean = false) {
        if (this.config.gameMode !== 'DIPLOMACY') return; // CHANGED: Strict restriction to Diplomacy
        if (bot.isHuman || this.isAttractMode) return;
        if (bot.personality === BotPersonality.NONE) return;

        if (!forced && this.currentTime - (bot.lastChatTime || 0) < 15000) return;
        if (!forced && bot.chatTimer > 500) return;

        let chance = 0.001;
        switch (category) {
            case 'KILL': chance = 0.005; break;
            case 'DEATH': chance = 0.01; break;
            case 'VENDETTA': chance = bot.personality === BotPersonality.TURTLE ? 0.01 : 0.002; break;
            case 'WINNING': chance = 0.001; break;
            case 'LOOT': chance = bot.personality === BotPersonality.SCAVENGER ? 0.005 : 0.0001; break;
            case 'HUNT': chance = 0.05; break;
            case 'STAGNATION': chance = 1.0; break;
            case 'REPLY_TO_DEATH':
            case 'REPLY_TO_KILL':
            case 'REPLY_GENERIC': chance = 0.6; break;
        }

        if (!forced && this.random() > chance) return;

        const text = this.getChatLine(category, bot.personality);
        if (text) {
            bot.chatMessage = text;
            bot.chatTimer = 4000;
            bot.lastChatType = category;
            bot.lastChatTime = this.currentTime;
        }
    }

    private handleSocialInteraction(bot: Player, now: number) {
        if (now - (bot.lastSocialCheck || 0) < 2000) return;
        bot.lastSocialCheck = now;
        if (bot.chatTimer > 0) return;

        for (const other of this.players.values()) {
            if (other.id === bot.id || other.isEliminated) continue;
            if (other.chatTimer > 2500 && other.chatMessage && other.lastChatType) {
                const dist = Math.hypot(bot.centerX - other.centerX, bot.centerY - other.centerY);
                if (dist > 25) continue;

                let responseCategory: ChatCategory | null = null;
                if (other.lastChatType === 'KILL' || other.lastChatType === 'WINNING') {
                    responseCategory = 'REPLY_TO_KILL';
                } else if (other.lastChatType === 'DEATH') {
                    responseCategory = 'REPLY_TO_DEATH';
                } else if (other.lastChatType === 'VENDETTA') {
                    if (bot.personality === BotPersonality.AGGRESSOR) responseCategory = 'REPLY_GENERIC';
                }

                if (responseCategory) {
                    this.botSpeak(bot, responseCategory);
                    return;
                }
            }
        }
    }

    private generateArmy(playerId: string, startX: number, startY: number) {
        const createUnit = (type: UnitType, ox: number, oy: number) => {
            const id = `${playerId}-${type}-${ox}-${oy}`;
            const unit: Unit = {
                id,
                ownerId: playerId,
                type,
                x: startX + ox,
                y: startY + oy,
                lastMoveTime: 0,
                hp: 1, // FIX: All units have 1 HP for instant capture
                isDead: false,
            };
            this.units.set(id, unit);
            this.positionMap.set(`${unit.x},${unit.y}`, id);
            return id;
        };

        const unitIds: string[] = [];
        for (let i = 0; i < 10; i++) unitIds.push(createUnit(UnitType.PAWN, i - 4, -1));
        for (let i = 0; i < 10; i++) unitIds.push(createUnit(UnitType.PAWN, i - 4, 1));
        const middleRow = [UnitType.PAWN, UnitType.ROOK, UnitType.KNIGHT, UnitType.BISHOP, UnitType.QUEEN, UnitType.KING, UnitType.BISHOP, UnitType.KNIGHT, UnitType.ROOK, UnitType.PAWN];
        middleRow.forEach((type, idx) => unitIds.push(createUnit(type, idx - 4, 0)));
        return unitIds;
    }

    // --- SANDBOX HELPERS ---

    public clearMap(): void {
        this.units.clear();
        this.positionMap.clear();
        this.coins.clear();
        this.players.forEach(player => {
            player.units = [];
        });
    }

    public spawnUnitRaw(x: number, y: number, type: UnitType, ownerId: string): string | null {
        const player = this.players.get(ownerId);
        if (!player) return null;

        const posKey = `${x},${y}`;

        // Remove existing unit at this position if any
        const existingId = this.positionMap.get(posKey);
        if (existingId) {
            const existing = this.units.get(existingId);
            if (existing) {
                const existingOwner = this.players.get(existing.ownerId);
                if (existingOwner) {
                    existingOwner.units = existingOwner.units.filter(uid => uid !== existingId);
                }
            }
            this.units.delete(existingId);
            this.positionMap.delete(posKey);
        }

        // Create the new unit
        const id = `${ownerId}-raw-${x}-${y}-${Date.now()}`;
        const unit: Unit = {
            id,
            ownerId,
            type,
            x,
            y,
            lastMoveTime: 0,
            hp: 1,
            isDead: false,
        };

        this.units.set(id, unit);
        this.positionMap.set(posKey, id);
        player.units.push(id);

        // Trigger spawn particle effect
        this.eventQueue.push({
            type: GameEventType.SPAWN,
            x,
            y,
            metadata: { color: player.color }
        });

        return id;
    }

    public removeUnitAt(x: number, y: number): boolean {
        const posKey = `${x},${y}`;
        const unitId = this.positionMap.get(posKey);
        if (!unitId) return false;

        const unit = this.units.get(unitId);
        if (unit) {
            const owner = this.players.get(unit.ownerId);
            if (owner) {
                owner.units = owner.units.filter(uid => uid !== unitId);
            }
            this.eventQueue.push({
                type: GameEventType.DEATH,
                x, y,
                metadata: { color: owner?.color || '#ff0000' }
            });
        }

        this.units.delete(unitId);
        this.positionMap.delete(posKey);
        return true;
    }

    public spawnCoins(minX: number, maxX: number, minY: number, maxY: number) {
        if (this.config.gameMode === 'STANDARD') return;

        for (let i = 0; i < 200; i++) {
            const x = Math.floor(minX + this.random() * (maxX - minX));
            const y = Math.floor(minY + this.random() * (maxY - minY));
            if (!this.positionMap.has(`${x},${y}`) && !this.coins.has(`${x},${y}`)) {
                const id = `${x},${y}`;
                this.coins.set(id, { id, x, y, value: 1 });
            }
        }
    }

    initAttractMode() {
        this.isAttractMode = true;
        this.attractSeed = 54321;
        this.isResigned = false;
        this.units.clear();
        this.players.clear();
        this.positionMap.clear();
        this.coins.clear();
        this.aiUpdateIndex = 0;
        this.directorCheckIndex = 0;
        this.cachedGameOverStats = null;
        this.humanKiller = null;
        this.activeVaultId = null;
        this.timeMultiplier = 1;

        // Force standard settings for background battle
        this.config = {
            humanColor: this.config?.humanColor || '#3b82f6',
            difficulty: 'Medium',
            gameMode: 'STANDARD'
        };

        const now = Date.now();
        this.gameStartTime = now;
        this.virtualTime = now;

        const createAttractPlayer = (id: string, color: string, centerX: number) => {
            this.players.set(id, {
                id, isHuman: false, color, centerX, centerY: 0, isEliminated: false, units: [],
                credits: 1000, totalCollected: 0, materialScore: 0, peakMaterial: 0, kills: 0, kingsKilled: 0, lastScoreTime: now,
                aiState: AIState.SIEGE, lastAiUpdate: now - Math.random() * 2000, lastActionUpdate: now - Math.random() * 500,
                lastRegroupTime: now, personality: BotPersonality.AGGRESSOR, chatMessage: null, chatTimer: 0,
                lastSocialCheck: now, lastChatTime: 0, allies: [], enemies: [], diplomacyState: 'NEUTRAL',
                lastActionTime: 0, actionDelay: 500, lastCombatTime: now,
                lastMovedLane: 0, combatStartTime: now, totalWarActive: false
            });
        };

        createAttractPlayer('attract-blue', COLORS.HUMAN, -20);
        createAttractPlayer('attract-red', COLORS.BOT, 20);

        const spawn = (pid: string, type: UnitType, x: number, y: number) => {
            if (this.positionMap.has(`${x},${y}`)) return;
            const id = `${pid}-${type}-${x}-${y}-${Math.floor(this.random() * 1000000)}`;
            const unit: Unit = { id, ownerId: pid, type, x, y, lastMoveTime: 0, hp: 1, isDead: false };
            this.units.set(id, unit);
            this.positionMap.set(`${x},${y}`, id);
            const p = this.players.get(pid);
            if (p) p.units.push(id);
        };

        for (let i = 0; i < 300; i++) {
            const r = this.random();
            const isBlue = r > 0.5;
            const pid = isBlue ? 'attract-blue' : 'attract-red';
            const centerX = isBlue ? -15 : 15;
            const x = Math.floor(centerX + (this.random() - 0.5) * 60);
            const y = Math.floor((this.random() - 0.5) * 50);
            let type = UnitType.PAWN;
            const rt = this.random();
            if (rt > 0.96) type = UnitType.QUEEN; else if (rt > 0.90) type = UnitType.ROOK; else if (rt > 0.80) type = UnitType.KNIGHT; else if (rt > 0.70) type = UnitType.BISHOP;
            spawn(pid, type, x, y);
        }
        spawn('attract-blue', UnitType.KING, -5, 0);
        spawn('attract-red', UnitType.KING, 5, 0);
    }

    // --- HELPER: Extract Hue from Hex ---
    private hexToHue(hex: string): number {
        let r = 0, g = 0, b = 0;
        if (hex.length === 4) {
            r = parseInt("0x" + hex[1] + hex[1]);
            g = parseInt("0x" + hex[2] + hex[2]);
            b = parseInt("0x" + hex[3] + hex[3]);
        } else if (hex.length === 7) {
            r = parseInt("0x" + hex[1] + hex[2]);
            g = parseInt("0x" + hex[3] + hex[4]);
            b = parseInt("0x" + hex[5] + hex[6]);
        }
        r /= 255; g /= 255; b /= 255;

        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h = 0;

        if (max === min) {
            h = 0;
        } else {
            const d = max - min;
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return h * 360;
    }

    initGame() {
        this.isAttractMode = false;
        this.isResigned = false;
        this.units.clear();
        this.players.clear();
        this.positionMap.clear();
        this.coins.clear();
        this.aiUpdateIndex = 0;
        this.directorCheckIndex = 0;
        this.cachedGameOverStats = null;
        this.humanKiller = null;
        this.activeVaultId = null;
        this.nextVaultTimer = this.random() * 15000 + 45000; // First vault in 45-60s

        this.peaceTimer = this.config.gameMode === 'DIPLOMACY' ? 30000 : 0;

        this.wave = 0;
        this.waveTimer = 10000;
        if (this.config.gameMode === 'ZOMBIES') {
            this.players.set(ZOMBIE_TEAM_ID, {
                id: ZOMBIE_TEAM_ID, isHuman: false, color: COLORS.ZOMBIE_GREEN, centerX: 0, centerY: 0, isEliminated: false,
                units: [], credits: 0, totalCollected: 0, materialScore: 0, peakMaterial: 0, kills: 0, kingsKilled: 0, lastScoreTime: Date.now(),
                aiState: AIState.PANIC, allies: [], enemies: [], diplomacyState: 'WAR', personality: BotPersonality.NONE, chatMessage: null, chatTimer: 0,
                lastActionTime: 0, actionDelay: 200, lastCombatTime: Date.now(),
                lastMovedLane: 0, combatStartTime: Date.now(), totalWarActive: false
            });
        }

        let pid = 0;
        const now = this.currentTime;
        const humanIndex = Math.floor(this.random() * 100);
        this.humanId = `player-${humanIndex}`;
        const SPACING_X = 18; const SPACING_Y = 10; const HALF_X = 4.5; const HALF_Y = 4.5;

        const profile = this.getDifficultyProfile();

        for (let row = 0; row < 10; row++) {
            for (let col = 0; col < 10; col++) {
                const id = `player-${pid}`;
                const isHuman = pid === humanIndex;
                const centerX = (col - HALF_X) * SPACING_X;
                const centerY = (row - HALF_Y) * SPACING_Y;
                const unitIds = this.generateArmy(id, centerX, centerY);
                let initialScore = 0;
                unitIds.forEach(uid => { const u = this.units.get(uid); if (u) initialScore += MATERIAL_VALUES[u.type] || 0; });

                let color;
                if (isHuman) {
                    color = this.config.humanColor;
                } else {
                    let hue = Math.floor((pid * 137.508) % 360);

                    // --- COLOR COLLISION AVOIDANCE ---
                    const humanHue = this.hexToHue(this.config.humanColor);

                    // If too close (within 35 degrees), shift by 180 (complementary) or at least 45
                    let diff = Math.abs(hue - humanHue);
                    if (diff > 180) diff = 360 - diff; // shortest arc

                    if (diff < 35) {
                        hue = (hue + 180) % 360; // Flip to opposite side
                    }

                    color = `hsl(${hue}, 75%, 50%)`;
                }

                let personality = BotPersonality.NONE;
                if (!isHuman) {
                    if (this.config.gameMode === 'BULLET') {
                        personality = BotPersonality.AGGRESSOR;
                    } else {
                        const profile = this.getDifficultyProfile();
                        const r = this.random();
                        const w = profile.personalityWeights;
                        if (r < w.aggressor) personality = BotPersonality.AGGRESSOR; else if (r < w.aggressor + w.turtle) personality = BotPersonality.TURTLE; else if (r < w.aggressor + w.turtle + w.scavenger) personality = BotPersonality.SCAVENGER; else personality = BotPersonality.AVENGER;
                    }
                }

                this.players.set(id, {
                    id, isHuman, color, centerX, centerY, isEliminated: false, units: unitIds, credits: 0, totalCollected: 0,
                    materialScore: initialScore, peakMaterial: initialScore, kills: 0, kingsKilled: 0, lastScoreTime: now, aiState: AIState.SIEGE, aiTargetId: null,
                    lastAiUpdate: now - Math.random() * 3000, lastRegroupTime: now, personality, chatMessage: null, chatTimer: 0, siegeStartTime: 0,
                    currentSiegeTargetId: null, isHunting: false, lastSocialCheck: now - Math.random() * 2000, lastActionUpdate: now - Math.random() * 500, lastChatTime: 0,
                    allies: [], enemies: [], diplomacyState: 'NEUTRAL',
                    lastActionTime: 0,
                    actionDelay: profile.reactionDelay,
                    lastCombatTime: now,
                    lastMovedLane: 0,
                    combatStartTime: now,
                    totalWarActive: false
                });
                pid++;
            }
        }
        this.spawnCoins(-120, 120, -80, 80);
        this.lastHumanCombatTime = now;
        this.lastDirectorCheck = now;

        // Generate World Terrain (only if mapType is set and not EMPTY)
        this.terrainMap.clear();
        const mapType = this.config.mapType || 'EMPTY';
        if (mapType !== 'EMPTY') {
            const playerPositions: { x: number; y: number }[] = [];
            for (const p of this.players.values()) {
                playerPositions.push({ x: Math.round(p.centerX), y: Math.round(p.centerY) });
            }
            this.terrainMap = WorldGenerator.generate(
                mapType,
                playerPositions,
                Math.floor(Date.now() % 100000)
            );
        }

        // Initialize Game Mode Strategy
        if (this.config.gameMode === 'ZOMBIES') this.activeMode = new ZombieMode();
        else if (this.config.gameMode === 'DIPLOMACY') this.activeMode = new DiplomacyMode();
        else if (this.config.gameMode === 'SANDBOX') this.activeMode = new SandboxMode();
        else this.activeMode = new StandardMode();
        this.activeMode.init(this);
    }

    private countFriendlyUnitsInRadius(playerId: string, x: number, y: number, radius: number): number {
        let count = 0;
        const player = this.players.get(playerId);
        if (!player) return 0;
        for (const uid of player.units) {
            const u = this.units.get(uid);
            if (u && !u.isDead) {
                const d = Math.abs(u.x - x) + Math.abs(u.y - y);
                if (d <= radius) count++;
            }
        }
        return count;
    }

    private getDistanceToNearestEnemy(playerId: string, x: number, y: number): number {
        let nearest = Infinity;
        for (let dx = -4; dx <= 4; dx++) {
            for (let dy = -4; dy <= 4; dy++) {
                if (dx === 0 && dy === 0) continue;
                const tid = this.positionMap.get(`${x + dx},${y + dy}`);
                if (tid) {
                    const t = this.units.get(tid);
                    if (t && t.ownerId !== playerId) {
                        const dist = Math.max(Math.abs(dx), Math.abs(dy));
                        if (dist < nearest) nearest = dist;
                    }
                }
            }
        }
        return nearest;
    }

    private botPurchaseReinforcements(bot: Player): boolean {
        if (bot.isHuman || bot.id === ZOMBIE_TEAM_ID) return false;

        // Count alive units
        let aliveCount = 0;
        for (const uid of bot.units) {
            const u = this.units.get(uid);
            if (u && !u.isDead) aliveCount++;
        }

        // Difficulty-based unit cap when targeting player
        // Bot-vs-bot combat remains unrestricted at 15 units
        let maxUnits = 15;
        if (bot.aiTargetId === this.humanId) {
            // Apply stricter limits when fighting the player
            maxUnits = this.config.difficulty === 'Easy' ? 8 :
                this.config.difficulty === 'Medium' ? 10 : 12;
        }

        // Limit unit count to prevent runaway spam
        if (aliveCount >= maxUnits) return false;

        // --- BLITZ V3: QUALITY REINFORCEMENTS ---
        const phase = this.directorState.phase;
        const isEndgame = (phase === 'CONVERGENCE' || phase === 'SUDDEN_DEATH');

        let purchaseList: UnitType[] = [];
        const roll = this.random();

        if (isEndgame) {
            // Lethal material only.
            purchaseList = roll < 0.6 ? [UnitType.QUEEN, UnitType.ROOK] : [UnitType.ROOK, UnitType.QUEEN];
        } else {
            // Variety: Weighted Random roll
            if (roll < 0.6) {
                purchaseList = [UnitType.QUEEN, UnitType.ROOK, UnitType.BISHOP, UnitType.KNIGHT];
            } else {
                purchaseList = [UnitType.ROOK, UnitType.BISHOP, UnitType.KNIGHT, UnitType.QUEEN];
            }

            if (aliveCount < 5) {
                purchaseList.push(UnitType.PAWN);
            }
        }

        for (const type of purchaseList) {
            const cost = SHOP_PRICES[type];
            if (bot.credits >= cost) {
                let spawnTiles = this.getValidSpawnTiles(bot.id);
                if (spawnTiles.length > 0) {
                    // --- SAFETY FILTER ---
                    spawnTiles = spawnTiles.filter(t => !this.isPositionDangerous(t.x, t.y, bot));
                    if (spawnTiles.length === 0) continue; // No safe tiles for this bot right now

                    // --- TACTICAL SORTING (Offensive Placement) ---
                    const targetPlayer = bot.aiTargetId ? this.players.get(bot.aiTargetId) : null;
                    if (targetPlayer && !targetPlayer.isEliminated) {
                        spawnTiles.sort((a, b) => {
                            const distA = Math.hypot(a.x - targetPlayer.centerX, a.y - targetPlayer.centerY);
                            const distB = Math.hypot(b.x - targetPlayer.centerX, b.y - targetPlayer.centerY);
                            return distA - distB;
                        });
                    }

                    // Pick the best (closest and safe) tile
                    const tile = spawnTiles[0];
                    this.buyUnit(bot.id, type, tile.x, tile.y);
                    return true; // One purchase per thought cycle
                }
            }
        }
        return false;
    }

    private executeBotTurn(bot: Player, now: number) {
        // 0. Setup: Identify King
        const kingId = bot.units.find(uid => this.units.get(uid)?.type === UnitType.KING);
        const king = kingId ? this.units.get(kingId) : undefined;
        if (!king || king.isDead) return;

        const profile = this.getDifficultyProfile();

        // 1. GLOBAL APM TIMER (Bot Reaction Speed)
        // UNIVERSAL MEAT GRINDER: Bots fight each other AT THE SAME SUPER HIGH SPEED (50ms base).
        // FAIR DUELS: Bots fight the human at difficulty-based speeds (2s, 0.6s, 0.2s) that scale down.
        let effectiveDelay = 50;
        const phase = this.directorState.phase;

        if (this.isAttractMode) {
            effectiveDelay = 0;
        } else {
            const human = this.players.get(this.humanId);
            const isFacingHuman = (bot.aiTargetId === this.humanId) || (bot.lastAttackerId === this.humanId && (now - (bot.lastDamageTime || 0) < 10000));

            if (isFacingHuman) {
                // DIFFICULTY-BASED SPEED (FOR HUMANS)
                effectiveDelay = profile.reactionDelay;

                // Scaling for Endgame
                if (phase === 'SUDDEN_DEATH') effectiveDelay *= 0.5;
                else if (phase === 'CONVERGENCE') effectiveDelay *= 0.75;

                // Hard Floor for Human Fairness
                effectiveDelay = Math.max(effectiveDelay, 100);
            } else {
                // UNIVERSAL SPEED (BOT VS BOT)
                effectiveDelay = 50; // Chaos/Hunt base

                if (phase === 'SUDDEN_DEATH') effectiveDelay = 0; // Physics Only
                else if (phase === 'CONVERGENCE') effectiveDelay = 25;
            }
        }

        // 1C. TRAVEL APM (Fast-Forwarding across empty space)
        // If the bot is far from its target, move instantly to push them into the fight.
        const distToTargetForApm = bot.aiTargetId ? this.getDistanceBetweenPlayers(bot.id, bot.aiTargetId) : 100;
        if (distToTargetForApm > 15 && !bot.isHuman) {
            effectiveDelay = 0;
        }

        // Time Gate with modified delay
        if (now - bot.lastActionTime < effectiveDelay) {
            return;
        }

        // --- BOT REINFORCEMENTS ---
        if (this.botPurchaseReinforcements(bot)) {
            bot.lastActionTime = now;
            return; // Action taken, bot turn ends (prevents moving in same frame)
        }

        // --- ENDGAME BLOODLUST (Hyper-Aggression) ---
        if (this.playersRemaining <= 10) {
            bot.totalWarActive = true;
        }

        // 1B. PRIORITY 0: EMERGENCY KING OVERRIDE (Safety Net)
        // Only runs if safety checks are enabled (Tactical/Grandmaster) AND Total War is not active
        // [BLITZ V3] Bots ONLY use safety checks if they are currently facing the human.
        // Bot-vs-Bot combat is ALWAYS reckless to speed up the game.
        const isFacingHuman = (bot.aiTargetId === this.humanId) || (bot.lastAttackerId === this.humanId && (now - (bot.lastDamageTime || 0) < 10000));
        const ignoreNonHumanThreats = !isFacingHuman;

        if (profile.enableSafetyChecks && !this.directorState.totalWar && this.isPositionDangerous(king.x, king.y, bot, ignoreNonHumanThreats)) {
            // FIX: King must respect cooldown even in emergency
            const kingMoves = this.getValidMoves(king, now, true);
            if (kingMoves.length > 0) {
                let bestSafeMove = null;
                let maxSafetyScore = -Infinity;

                for (const m of kingMoves) {
                    if (!this.isPositionDangerous(m.x, m.y, bot)) {
                        const distToEnemy = this.getDistanceToNearestEnemy(bot.id, m.x, m.y);
                        if (distToEnemy > maxSafetyScore) {
                            maxSafetyScore = distToEnemy;
                            bestSafeMove = m;
                        }
                    }
                }

                if (bestSafeMove) {
                    this.moveUnitInternal(king, bestSafeMove.x, bestSafeMove.y, now);
                    bot.lastActionTime = now; // Consume turn
                    return; // End turn immediately
                }
            }
        }

        // 3. TARGET ACQUISITION & VECTOR CALCULATION
        let targetPlayer: Player | undefined;
        let vectorX = 0;
        let vectorY = 0;
        let distToTarget = Infinity;

        // --- GOLD RUSH OVERRIDE ---
        if (this.activeVaultId && !bot.isHuman && bot.id !== ZOMBIE_TEAM_ID) {
            const vault = this.units.get(this.activeVaultId);
            if (vault && !vault.isDead) {
                const d = Math.hypot(vault.x - king.x, vault.y - king.y);
                // Nearby bots get greedy
                if (d < 50) {
                    bot.aiState = AIState.SCAVENGE;
                    vectorX = Math.sign(vault.x - king.x);
                    vectorY = Math.sign(vault.y - king.y);
                    distToTarget = d;
                }
            }
        }

        if (this.config.gameMode === 'ZOMBIES') {
            // ... (Zombie target logic)
            let nearestZombieDist = Infinity;
            let nearestZombie: Unit | null = null;
            for (let dx = -10; dx <= 10; dx += 2) {
                for (let dy = -10; dy <= 10; dy += 2) {
                    const tid = this.positionMap.get(`${king.x + dx},${king.y + dy}`);
                    if (tid) {
                        const u = this.units.get(tid);
                        if (u && u.ownerId === ZOMBIE_TEAM_ID) {
                            const d = Math.hypot(dx, dy);
                            if (d < nearestZombieDist) {
                                nearestZombieDist = d;
                                nearestZombie = u;
                            }
                        }
                    }
                }
            }
            if (nearestZombie) {
                const dx = nearestZombie.x - king.x;
                const dy = nearestZombie.y - king.y;
                if (Math.abs(dx) > 0 || Math.abs(dy) > 0) {
                    vectorX = Math.sign(dx);
                    vectorY = Math.sign(dy);
                    targetPlayer = this.players.get(ZOMBIE_TEAM_ID);
                    distToTarget = nearestZombieDist;
                }
            }
        }

        if (vectorX === 0 && vectorY === 0) {

            // DIRECTOR: Convergence (Center Gravity)
            if (this.directorState.centerGravity && !bot.isHuman) {
                // Pull towards 0,0
                const distToCenter = Math.hypot(king.x, king.y);
                if (distToCenter > 10) {
                    vectorX = -Math.sign(king.x);
                    vectorY = -Math.sign(king.y);

                    // HYPER-CONVERGENCE: If very few players, the center pull is much stronger than local logic
                    if (this.playersRemaining <= 10) {
                        distToTarget = distToCenter;
                    }
                }
            }

            if (vectorX === 0 && vectorY === 0) {
                if (bot.aiState === AIState.IDLE) {
                    const dist = Math.hypot(king.x, king.y);
                    if (dist > 15) { vectorX = -Math.sign(king.x); vectorY = -Math.sign(king.y); } else { const angle = (now / 2000) + (parseInt(bot.id.split('-')[1]) || 0); vectorX = Math.cos(angle); vectorY = Math.sin(angle); }
                } else {
                    if (bot.aiTargetId) {
                        const t = this.players.get(bot.aiTargetId);
                        if (t && !t.isEliminated) {
                            targetPlayer = t;
                        } else {
                            bot.aiTargetId = null;
                        }
                    }

                    if (bot.aiState === AIState.VENDETTA && bot.lastAttackerId) {
                        targetPlayer = this.players.get(bot.lastAttackerId);
                    }

                    if (!targetPlayer || targetPlayer.isEliminated) {
                        const vision = profile.visionRadius;
                        const candidates: { player: Player, dist: number }[] = [];
                        this.players.forEach(p => {
                            if (p.id !== bot.id && !p.isEliminated) {
                                if (this.config.gameMode === 'DIPLOMACY' && bot.allies.includes(p.id)) return;
                                if (this.config.gameMode === 'DIPLOMACY' && this.peaceTimer > 0 && !bot.enemies.includes(p.id)) return;
                                if (p.id === ZOMBIE_TEAM_ID) return;

                                let d = Math.hypot(p.centerX - bot.centerX, p.centerY - bot.centerY);

                                // Difficulty Tuning: Apply Player Target Bonus (makes human appear closer)
                                if (p.isHuman) {
                                    d -= profile.playerTargetBonus;
                                }

                                // DIRECTOR: Infinite Vision Phase
                                const effectiveVision = this.directorState.infiniteVision ? 1000 : vision;

                                if (d <= effectiveVision || bot.isHunting) {
                                    // --- DUEL HONOR (Don't third-party the human) ---
                                    // DISABLED in Endgame Bloodlust (< 10 players)
                                    if (this.playersRemaining > 10 && !p.isHuman && this.isFightingHuman(p, now)) {
                                        return; // Skip candidates fighting the player
                                    }
                                    candidates.push({ player: p, dist: d });
                                }
                            }
                        });


                        // --- GLOBAL MANHUNT (Endgame Fix) ---
                        // If no candidates in local vision and < 50 players, scan the whole map for the nearest King.
                        if (candidates.length === 0 && this.playersRemaining < 50) {
                            let nearestEnemy: Player | null = null;
                            let minPlayerDist = Infinity;

                            this.players.forEach(p => {
                                if (p.id !== bot.id && !p.isEliminated && p.id !== ZOMBIE_TEAM_ID) {
                                    if (this.config.gameMode === 'DIPLOMACY' && bot.allies.includes(p.id)) return;
                                    const d = Math.hypot(p.centerX - bot.centerX, p.centerY - bot.centerY);
                                    if (d < minPlayerDist) {
                                        minPlayerDist = d;
                                        nearestEnemy = p;
                                    }
                                }
                            });

                            if (nearestEnemy) {
                                targetPlayer = nearestEnemy;
                                bot.aiTargetId = targetPlayer.id;
                            }
                        }

                        if (candidates.length > 0) {
                            candidates.sort((a, b) => a.dist - b.dist);
                            const topK = candidates.slice(0, 3);
                            const choice = topK[Math.floor(this.random() * topK.length)];
                            targetPlayer = choice.player;
                            bot.aiTargetId = targetPlayer.id;
                        }
                    }

                    if (targetPlayer) {
                        distToTarget = Math.hypot(targetPlayer.centerX - king.x, targetPlayer.centerY - king.y);
                        const dx = targetPlayer.centerX - king.x;
                        const dy = targetPlayer.centerY - king.y;
                        if (Math.abs(dx) > 0 || Math.abs(dy) > 0) {
                            vectorX = Math.sign(dx);
                            vectorY = Math.sign(dy);
                        }
                    }
                }
            }
        }
        // 4. TOTAL WAR TIMER (Anti-Stalemate)
        if (bot.aiTargetId) {
            if (bot.aiTargetId !== bot.lastTargetId) {
                bot.combatStartTime = now;
                bot.totalWarActive = false;
                bot.lastTargetId = bot.aiTargetId;
            } else {
                // Accelerated Total War for Endgame
                let totalWarThreshold = 30000;
                if (this.playersRemaining <= 20) totalWarThreshold = 5000;
                else if (this.playersRemaining <= 40) totalWarThreshold = 10000;

                if (now - bot.combatStartTime > totalWarThreshold) {
                    if (!bot.totalWarActive) {
                        bot.totalWarActive = true;
                        // Don't chat too often, but announce it
                        if (Math.random() < 0.3) bot.chatMessage = "ALL OUT ATTACK!";
                    }
                }
            }
        } else {
            bot.totalWarActive = false;
            bot.combatStartTime = now;
        }

        // 5. DETERMINE TACTICAL STATE
        let currentMode: 'COMBAT' | 'MARCH' = 'MARCH';

        if (bot.aiState === AIState.PANIC || bot.aiState === AIState.VENDETTA) {
            currentMode = 'COMBAT';
        } else if (distToTarget <= 6) {
            currentMode = 'COMBAT';
        } else if (bot.aiState === AIState.SCAVENGE) {
            currentMode = 'MARCH';
        } else {
            currentMode = 'MARCH';
        }

        if (bot.tacticalMode !== currentMode) {
            bot.tacticalMode = currentMode;
            // FIX: Only allow tactical chat in Diplomacy mode
            if (this.config.gameMode === 'DIPLOMACY') {
                if (currentMode === 'COMBAT') {
                    if (bot.chatTimer <= 0) {
                        bot.chatMessage = "Engaging.";
                        bot.chatTimer = 2000;
                    }
                } else if (Math.random() < 0.3 && bot.chatTimer <= 0) {
                    bot.chatMessage = "Marching.";
                    bot.chatTimer = 2000;
                }
            }
        }

        const botUnits = bot.units.map(uid => this.units.get(uid)).filter(u => u && !u.isDead) as Unit[];
        const readyUnits = botUnits.filter(u => now - u.lastMoveTime >= this.getUnitCooldown(u.type));
        if (readyUnits.length === 0) return;

        const tx = targetPlayer ? targetPlayer.centerX : (king.x + vectorX * 10);
        const ty = targetPlayer ? targetPlayer.centerY : (king.y + vectorY * 10);

        const generalVectorX = Math.sign(tx - king.x);
        const generalVectorY = Math.sign(ty - king.y);

        // --- WIDE FRONT TACTICS: LANE SORTING ---
        // Instead of just distance, we use lanes relative to the vector
        // Lanes: Left (-1), Center (0), Right (1)
        const leftUnits: Unit[] = [];
        const centerUnits: Unit[] = [];
        const rightUnits: Unit[] = [];

        for (const u of readyUnits) {
            // Cross product to find side of line: (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
            // Line start (king), end (target), point (unit)
            // Simplified: vx * uy - vy * ux
            const relX = u.x - king.x;
            const relY = u.y - king.y;
            const cross = generalVectorX * relY - generalVectorY * relX;

            if (cross > 2) leftUnits.push(u); // Tweak threshold for lane width
            else if (cross < -2) rightUnits.push(u);
            else centerUnits.push(u);
        }

        // Cycle selection: Center -> Left -> Right -> Center
        // lastMovedLane: 0 (Center) -> Try Left (-1) -> Try Right (1) -> Try Center (0)
        let selectedLaneUnits: Unit[] = [];
        let nextLane = 0;

        if (bot.lastMovedLane === 0) { nextLane = -1; selectedLaneUnits = leftUnits; }
        else if (bot.lastMovedLane === -1) { nextLane = 1; selectedLaneUnits = rightUnits; }
        else { nextLane = 0; selectedLaneUnits = centerUnits; }

        // Update state
        bot.lastMovedLane = nextLane;

        // Fallback if lane is empty
        if (selectedLaneUnits.length === 0) {
            if (readyUnits.length > 0) selectedLaneUnits = readyUnits;
            else return;
        }

        // Sort selected units by proximity to front line (closest to enemy first)
        selectedLaneUnits.sort((a, b) => {
            const distA = Math.abs(a.x - tx) + Math.abs(a.y - ty);
            const distB = Math.abs(b.x - tx) + Math.abs(b.y - ty);
            if (currentMode === 'MARCH') {
                return distA - distB;
            } else {
                return distB - distA;
            }
        });

        // 6. HIGH-APM SELECTION LOOP (The Machine Gun)
        // Instead of picking one unit and giving up, we iterate through the WHOLE army.
        // We move the first unit that is ready. This allows bots to move different units every 50ms-400ms.
        for (const unit of selectedLaneUnits) {
            // Check unit cooldown strictly (Physics)
            if (now - unit.lastMoveTime < this.getUnitCooldown(unit.type)) continue;

            // --- MOSH PIT TARGETING: Find closest enemy to THIS unit ---
            // Don't just aim for the King. Aim for the nearest guy to create a wide front.
            let localTx = tx;
            let localTy = ty;
            let localTarget: Unit | null = null;

            if (currentMode === 'COMBAT') {
                let minDist = Infinity;
                // Scan radius
                for (let dx = -10; dx <= 10; dx++) {
                    for (let dy = -10; dy <= 10; dy++) {
                        const scanTid = this.positionMap.get(`${unit.x + dx},${unit.y + dy}`);
                        if (scanTid) {
                            const scanU = this.units.get(scanTid);
                            if (scanU && scanU.ownerId !== unit.ownerId && !scanU.isDead) {
                                const d = Math.abs(dx) + Math.abs(dy);
                                if (d < minDist) {
                                    minDist = d;
                                    localTarget = scanU;
                                }
                            }
                        }
                    }
                }
                if (localTarget) {
                    localTx = localTarget.x;
                    localTy = localTarget.y;
                }
            }

            const moves = this.getValidMoves(unit, now, true);
            if (moves.length === 0) continue;

            let bestAction = { x: 0, y: 0, score: -Infinity };
            const targetKingId = targetPlayer ? targetPlayer.units.find(u => this.units.get(u)?.type === UnitType.KING) : null;
            const tKing = targetKingId ? this.units.get(targetKingId) : null;

            for (const m of moves) {
                let score = 0;
                const dx = Math.sign(m.x - unit.x);
                const dy = Math.sign(m.y - unit.y);

                // Alignment with LOCAL target
                const localVecX = Math.sign(localTx - unit.x);
                const localVecY = Math.sign(localTy - unit.y);
                const alignment = (localVecX * dx) + (localVecY * dy);

                if (alignment > 0) {
                    score += 500;
                } else if (alignment < 0) {
                    score -= 100;
                }

                const distAfter = Math.abs(m.x - localTx) + Math.abs(m.y - localTy);
                const distBefore = Math.abs(unit.x - localTx) + Math.abs(unit.y - localTy);
                if (distAfter < distBefore) score += 50;

                // --- DIFFICULTY TUNING: SAFETY CHECK ---
                // If Safety Checks are enabled (Tactical/Grandmaster) and move is dangerous, penalize heavily
                // [BLITZ V3] Only apply safety checks if facing human
                if (profile.enableSafetyChecks && !ignoreNonHumanThreats) {
                    if (this.isPositionDangerous(m.x, m.y, bot)) {
                        score -= 5000;
                    }
                }

                // --- DIFFICULTY TUNING: MINIMAX (ADVANCED TARGETING) ---
                // Grandmaster: Focus fire on Kings or units blocking the path
                if (profile.enableMinimax) {
                    // Bonus for moving closer to the MAIN target (King) even if dealing with local threats
                    const distToKing = Math.abs(m.x - tx) + Math.abs(m.y - ty);
                    if (distToKing < Math.abs(unit.x - tx) + Math.abs(unit.y - ty)) {
                        score += 200; // relentless pressure
                    }

                    // Aggressive King hunting: If alignment with KING is perfect
                    const kVecX = Math.sign(tx - unit.x);
                    const kVecY = Math.sign(ty - unit.y);
                    if (Math.sign(m.x - unit.x) === kVecX && Math.sign(m.y - unit.y) === kVecY) {
                        score += 300;
                    }
                }

                // --- FORMATION SCORING ---
                // 1. Shield Wall Bonus: Check perpendicular tiles for friends
                const p1 = this.positionMap.get(`${m.x - dy},${m.y + dx}`);
                if (p1 && this.units.get(p1)?.ownerId === unit.ownerId) score += 20;

                const p2 = this.positionMap.get(`${m.x + dy},${m.y - dx}`);
                if (p2 && this.units.get(p2)?.ownerId === unit.ownerId) score += 20;

                // 2. Conga Line Penalty / Flanking Preference
                const front = this.positionMap.get(`${m.x + dx},${m.y + dy}`);
                if (front && this.units.get(front)?.ownerId === unit.ownerId) {
                    score -= 50; // Penalty for stacking
                }

                // 3. FLANKING VISUALS (Wrap Around)
                if (!bot.totalWarActive) {
                    if (Math.abs(dx) !== Math.abs(generalVectorX) || Math.abs(dy) !== Math.abs(generalVectorY)) {
                        score += 10;
                    }
                }

                // Standard Capture Logic
                const targetId = this.positionMap.get(`${m.x},${m.y}`);
                let isCapture = false;

                if (targetId) {
                    const target = this.units.get(targetId);
                    if (target && target.ownerId !== unit.ownerId) {
                        // --- DUEL HONOR (Don't steal player's kills) ---
                        const targetPlayer = this.players.get(target.ownerId);
                        if (targetPlayer && !targetPlayer.isHuman && this.isFightingHuman(targetPlayer, now)) {
                            score -= 20000; // Heavily penalize third-partying
                        }

                        isCapture = true;

                        // --- THE LOBOTOMY (Easy Mode Greedy Filter) ---
                        if (this.config.difficulty === 'Easy') {
                            score += 10000; // MUST CAPTURE. NO THINKING.
                        }

                        if (target.type === UnitType.KING) {
                            score += 10000;
                        } else if (target.type === UnitType.VAULT) {
                            score += 5000;
                        } else {
                            // Cadet (Easy) mode is greedy, takes any capture
                            let tradeScore = this.getUnitValue(target.type) * 20;

                            // Protect King logic (Only if Safety Enabled)
                            if (profile.enableSafetyChecks && king && (tKing || targetPlayer)) {
                                const tX = tKing ? tKing.x : tx;
                                const tY = tKing ? tKing.y : ty;
                                const subDist = Math.hypot(king.x - m.x, king.y - m.y) + Math.hypot(m.x - tX, m.y - tY);
                                const totalDist = Math.hypot(king.x - tX, king.y - tY);
                                if (subDist <= totalDist + 2.5) {
                                    tradeScore *= 2.0;
                                }
                            }
                            score += tradeScore;
                        }
                    }
                }

                // --- TOTAL WAR OVERRIDES ---
                if (bot.totalWarActive) {
                    if (isCapture) score += 20000;
                    if (unit.type === UnitType.KING && alignment > 0) score += 5000;
                }

                score += this.random() * 5;
                if (score > bestAction.score) {
                    bestAction = { x: m.x, y: m.y, score };
                }
            }

            // If we found a good move for THIS unit, commit it and END the loop.
            // This preserves the "One bot move per APM tick" global rule.
            if (bestAction.score > -Infinity) {
                this.moveUnitInternal(unit, bestAction.x, bestAction.y, now);
                return; // Action taken, bot turn ends
            }
        }
    }


    public getLeaderboard(): LeaderboardEntry[] {
        const entries: LeaderboardEntry[] = [];
        const playersArray = Array.from(this.players.values());

        const calculatedEntries = playersArray.map(p => {
            let currentScore = 0;
            if (!p.isEliminated) {
                for (const uid of p.units) {
                    const u = this.units.get(uid);
                    if (u && !u.isDead) {
                        // Sum material values of alive units (King is 0 in MATERIAL_VALUES)
                        currentScore += MATERIAL_VALUES[u.type] || 0;
                    }
                }
            }
            return {
                playerId: p.id,
                isHuman: p.isHuman,
                color: p.color,
                score: currentScore,
                rank: 0,
                isEliminated: p.isEliminated,
                kills: p.kills
            };
        });

        // Sort by active status, then score, then kills
        calculatedEntries.sort((a, b) => {
            if (a.isEliminated !== b.isEliminated) return a.isEliminated ? 1 : -1;
            if (a.score !== b.score) return b.score - a.score;

            // Tie-breaker: Later timestamp is higher
            const pA = this.players.get(a.playerId);
            const pB = this.players.get(b.playerId);
            if (pA && pB) {
                return pB.lastScoreTime - pA.lastScoreTime;
            }
            return b.kills - a.kills;
        });

        // Assign Ranks
        const finalEntries: LeaderboardEntry[] = calculatedEntries.map((e, index) => ({
            playerId: e.playerId,
            isHuman: e.isHuman,
            color: e.color,
            score: e.score,
            rank: index + 1
        }));

        // Find human to include if not in top 8
        const humanEntry = finalEntries.find(e => e.isHuman);
        if (humanEntry && humanEntry.rank > 8) {
            return [...finalEntries.slice(0, 7), humanEntry];
        }
        return finalEntries.slice(0, 8);
    }

    public consumeEvents(): GameEvent[] {
        const events = [...this.eventQueue];
        this.eventQueue = [];
        return events;
    }

    public tick() {
        if (this.paused) return;

        const now = Date.now();
        const delta = (now - this.lastRealTime) * this.timeMultiplier;
        this.lastRealTime = now;
        this.virtualTime += delta;

        const gameTime = this.virtualTime;

        // MODE UPDATE (handles wave timer, peace timer, director AI)
        this.activeMode.update(this, delta);

        // Update Vault Timer (not mode-specific)
        if (this.nextVaultTimer > 0) {
            this.nextVaultTimer -= delta;
        }

        // Bots
        const players = Array.from(this.players.values());
        const batchSize = Math.ceil(players.length / 5); // Distribute over ~5 ticks
        for (let i = 0; i < batchSize; i++) {
            const p = players[this.aiUpdateIndex % players.length];
            this.aiUpdateIndex++;
            if (p && !p.isHuman && !p.isEliminated) {

                // CHAT FAILSAFE: Clear chat if not Diplomacy
                if (this.config.gameMode !== 'DIPLOMACY' && p.chatMessage) {
                    p.chatMessage = null;
                }

                this.executeBotTurn(p, gameTime);
                this.updateDiplomacy(p, gameTime);
                this.handleSocialInteraction(p, gameTime);
            }
        }
    }

    public moveUnitInternal(unit: Unit, x: number, y: number, now: number): boolean {
        let targetId = this.positionMap.get(`${x},${y}`);
        let target = targetId ? this.units.get(targetId) : undefined;

        if (targetId && (!target || target.isDead)) {
            this.positionMap.delete(`${x},${y}`);
            targetId = undefined;
            target = undefined;
        }

        let isCapture = false;
        let targetDied = false;
        let victimPlayer: Player | undefined;

        if (target) {
            // Delegate attack permission to active game mode
            if (!this.activeMode.canAttack(unit, target, this)) return false;

            if (this.config.gameMode === 'DIPLOMACY') {
                this.declareWar(unit.ownerId, target.ownerId);
            }

            // UPDATE COMBAT TIMERS
            const killer = this.players.get(unit.ownerId);
            if (killer) killer.lastCombatTime = now;
            victimPlayer = this.players.get(target.ownerId);
            if (victimPlayer) victimPlayer.lastCombatTime = now;

            // Delegate death handling to active game mode
            const modeHandled = this.activeMode.handleDeath(target, unit, this);
            if (modeHandled) { unit.lastMoveTime = now; return true; }

            // [COMMENTED OUT - Legacy zombie infection block, now handled by ZombieMode.handleDeath()]
            // if (this.config.gameMode === 'ZOMBIES' && unit.ownerId === ZOMBIE_TEAM_ID) {
            //     if (target.type !== UnitType.KING && target.type !== UnitType.VAULT) {
            //         const originalOwnerId = target.ownerId;
            //         const originalOwner = this.players.get(originalOwnerId);
            //         if (originalOwner) {
            //             originalOwner.units = originalOwner.units.filter(uid => uid !== target.id);
            //         }
            //         target.ownerId = ZOMBIE_TEAM_ID;
            //         target.hp = 1;
            //         target.isZombie = true;
            //         const zombiePlayer = this.players.get(ZOMBIE_TEAM_ID);
            //         if (zombiePlayer) {
            //             zombiePlayer.units.push(target.id);
            //         }
            //         this.eventQueue.push({
            //             type: GameEventType.CONVERSION,
            //             x: target.x,
            //             y: target.y,
            //             metadata: {
            //                 color: COLORS.ZOMBIE_GREEN,
            //                 victimId: target.ownerId,
            //                 attackerId: unit.ownerId
            //             }
            //         });
            //         unit.lastMoveTime = now;
            //         return true;
            //     }
            // }

            target.hp -= 1;

            if (victimPlayer) {
                victimPlayer.lastAttackerId = unit.ownerId;
                victimPlayer.lastDamageTime = now;
                if (victimPlayer.aiState !== AIState.PANIC) { victimPlayer.aiState = AIState.VENDETTA; }
                if (Math.random() < 0.3) this.botSpeak(victimPlayer, 'VENDETTA');
            }
            if (target.hp <= 0) {
                target.isDead = true; targetDied = true; this.positionMap.delete(`${target.x},${target.y}`);

                // UPDATE SCORE TIME FOR VICTIM
                if (victimPlayer) victimPlayer.lastScoreTime = now;

                if (killer) {
                    let scoreReward = MATERIAL_VALUES[target.type];
                    let creditReward = SHOP_PRICES[target.type];

                    // King Bounty Override: Give 20 coins/score for eliminating a player
                    if (target.type === UnitType.KING) {
                        scoreReward = 20;
                        creditReward = 20;
                        killer.kingsKilled++;
                    }

                    killer.kills++;
                    killer.materialScore += scoreReward;
                    if (killer.materialScore > killer.peakMaterial) killer.peakMaterial = killer.materialScore;
                    killer.credits += creditReward;

                    if (target.type === UnitType.VAULT) {
                        this.botSpeak(killer, 'LOOT', true);
                        this.eventQueue.push({
                            type: GameEventType.COIN_PICKUP,
                            x: target.x,
                            y: target.y,
                            metadata: { amount: 50, isKillReward: true }
                        });
                    } else {
                        this.botSpeak(killer, 'KILL');
                        this.eventQueue.push({
                            type: GameEventType.COIN_PICKUP,
                            x: target.x,
                            y: target.y,
                            metadata: {
                                amount: creditReward,
                                isKillReward: true,
                                playerId: killer.id
                            }
                        });
                    }
                }
                if (target.ownerId === this.humanId) { this.humanKiller = { name: killer ? (killer.isHuman ? 'You' : `Bot ${killer.id.split('-')[1]}`) : 'Unknown', type: unit.type, color: killer?.color || '#fff' }; }
                this.eventQueue.push({
                    type: GameEventType.DEATH,
                    x: target.x,
                    y: target.y,
                    metadata: {
                        color: victimPlayer?.color,
                        attackerId: unit.ownerId,
                        victimId: target.ownerId
                    }
                });
                if (target.type === UnitType.KING) {
                    if (victimPlayer) {
                        victimPlayer.isEliminated = true;
                        this.botSpeak(victimPlayer, 'DEATH', true);
                        victimPlayer.units.forEach(uid => {
                            const u = this.units.get(uid);
                            if (u && !u.isDead) {
                                u.isDead = true;
                                this.positionMap.delete(`${u.x},${u.y}`);
                                this.eventQueue.push({
                                    type: GameEventType.DEATH,
                                    x: u.x,
                                    y: u.y,
                                    metadata: {
                                        color: victimPlayer?.color,
                                        victimId: victimPlayer.id,
                                        isChainDeath: true
                                    }
                                });
                            }
                        });
                    }
                }
            }
            isCapture = true;
        }

        if (!targetId || targetDied) {
            this.positionMap.delete(`${unit.x},${unit.y}`); unit.x = x; unit.y = y; this.positionMap.set(`${x},${y}`, unit.id);
            const coinKey = `${x},${y}`; const coin = this.coins.get(coinKey);
            if (coin) {
                if (unit.ownerId !== ZOMBIE_TEAM_ID) {
                    const p = this.players.get(unit.ownerId); if (p) { p.credits += coin.value; p.totalCollected += coin.value; this.botSpeak(p, 'LOOT'); } this.coins.delete(coinKey); this.eventQueue.push({ type: GameEventType.COIN_PICKUP, x, y, metadata: { amount: coin.value } });
                }
            }
        }
        unit.lastMoveTime = now;

        const player = this.players.get(unit.ownerId);
        if (player && !player.isHuman) {
            player.lastActionTime = now;
        }

        return targetDied;
    }

    public getUnitValue(type: UnitType): number {
        return MATERIAL_VALUES[type] || 0;
    }

    public resign() {
        const human = this.players.get(this.humanId);
        if (human && !human.isEliminated) {
            human.isEliminated = true;
            this.isResigned = true;

            // Kill all human units
            human.units.forEach(uid => {
                const u = this.units.get(uid);
                if (u) {
                    u.isDead = true;
                    this.positionMap.delete(`${u.x},${u.y}`);
                    this.eventQueue.push({ type: GameEventType.DEATH, x: u.x, y: u.y, metadata: { color: human.color } });
                }
            });
        }
    }

    public checkGameOver(): GameOverStats | null {
        // Check cache
        if (this.cachedGameOverStats) return this.cachedGameOverStats;

        const human = this.players.get(this.humanId);

        // 1. Human Eliminated or Resigned
        if (human && (human.isEliminated || this.isResigned)) {
            const stats: GameOverStats = {
                isWin: false,
                rank: this.playersRemaining + 1, // +1 because we are out
                kills: human.kills,
                kingsKilled: human.kingsKilled,
                coins: human.totalCollected,
                timeSurvived: (this.currentTime - this.gameStartTime) / 1000,
                finalScore: human.materialScore,
                peakMaterial: human.peakMaterial,
                killerName: this.humanKiller?.name,
                killerType: this.humanKiller?.type,
                killerColor: this.humanKiller?.color,
                isResignation: this.isResigned
            };
            this.cachedGameOverStats = stats;
            return stats;
        }

        // 2. Human Won (Only one remaining)
        // Check active players (ignoring Zombies if they are just environment, but usually they count as a team)
        // If we are the only one left.
        const activePlayers = Array.from(this.players.values()).filter(p => !p.isEliminated && p.id !== ZOMBIE_TEAM_ID);

        if (activePlayers.length === 1 && activePlayers[0].id === this.humanId) {
            const stats: GameOverStats = {
                isWin: true,
                rank: 1,
                kills: human ? human.kills : 0,
                kingsKilled: human ? human.kingsKilled : 0,
                coins: human ? human.totalCollected : 0,
                timeSurvived: (this.currentTime - this.gameStartTime) / 1000,
                finalScore: human ? human.materialScore : 0,
                peakMaterial: human ? human.peakMaterial : 0
            };
            this.cachedGameOverStats = stats;
            return stats;
        }

        return null;
    }

    public getValidSpawnTiles(playerId: string): Coords[] {
        const player = this.players.get(playerId);
        if (!player) return [];

        const validTiles = new Set<string>();
        const result: Coords[] = [];

        // Iterate through all player units to find adjacency
        for (const unitId of player.units) {
            const unit = this.units.get(unitId);
            if (unit && !unit.isDead) {
                // Check 8 neighbors (including diagonals)
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dy = -1; dy <= 1; dy++) {
                        if (dx === 0 && dy === 0) continue;

                        const tx = unit.x + dx;
                        const ty = unit.y + dy;
                        const key = `${tx},${ty}`;

                        // Check if tile is empty and not already added
                        if (!this.positionMap.has(key) && !validTiles.has(key) && !WorldGenerator.isBlocking(this.terrainMap, tx, ty)) {
                            validTiles.add(key);
                            result.push({ x: tx, y: ty });
                        }
                    }
                }
            }
        }
        return result;
    }

    public buyUnit(playerId: string, type: UnitType, x: number, y: number): string | null {
        const player = this.players.get(playerId);
        if (!player) return null;

        const cost = SHOP_PRICES[type];
        if (player.credits < cost) return null;

        if (this.positionMap.has(`${x},${y}`)) return null;

        player.credits -= cost;

        const id = `${playerId}-${type}-${x}-${y}-${Math.random()}`;
        const unit: Unit = {
            id,
            ownerId: playerId,
            type,
            x,
            y,
            lastMoveTime: this.currentTime, // Spawn on cooldown
            hp: 1,
            isDead: false
        };

        this.units.set(id, unit);
        this.positionMap.set(`${x},${y}`, id);
        player.units.push(id);

        this.eventQueue.push({
            type: GameEventType.SPAWN,
            x,
            y,
            metadata: { color: player.color }
        });

        return id;
    }

    public issueCommand(unitIds: string[], x: number, y: number) {
        const now = this.currentTime;
        unitIds.forEach(uid => {
            const unit = this.units.get(uid);
            if (unit && !unit.isDead) {
                const cooldown = this.getUnitCooldown(unit.type);
                if (now - unit.lastMoveTime >= cooldown) {
                    // Validate move
                    const moves = this.getValidMoves(unit, now, false);
                    if (moves.some(m => m.x === x && m.y === y)) {
                        this.moveUnitInternal(unit, x, y, now);
                    }
                }
            }
        });
    }

    public getUnitPossibleMoves(unitId: string, checkCooldown: boolean = true): Coords[] {
        const unit = this.units.get(unitId);
        if (!unit || unit.isDead) return [];
        return this.getValidMoves(unit, this.currentTime, checkCooldown);
    }

    public isPositionDangerous(x: number, y: number, player: Player, ignoreNonHumanThreats: boolean = false): boolean {
        // --- BLUNDER MODE (Easy Mode) or SUDDEN DEATH ---
        if (this.config.difficulty === 'Easy' || this.directorState.totalWar) {
            return false;
        }

        const scanRadius = 8;
        for (let dx = -scanRadius; dx <= scanRadius; dx++) {
            for (let dy = -scanRadius; dy <= scanRadius; dy++) {
                if (dx === 0 && dy === 0) continue;
                const tid = this.positionMap.get(`${x + dx},${y + dy}`);
                if (tid) {
                    const u = this.units.get(tid);
                    if (u && u.ownerId !== player.id && !u.isDead && !this.isAlly(player.id, u.ownerId)) {

                        // [AI TUNING] If requested, bots ignore threats from other bots. They ONLY fear the Human.
                        if (ignoreNonHumanThreats && u.ownerId !== this.humanId) {
                            continue;
                        }

                        // Check if 'u' can attack (x,y)
                        const diffX = Math.abs(x - u.x);
                        const diffY = Math.abs(y - u.y);

                        // Pawn/King/Zombie (Range 1)
                        if ((u.type === UnitType.KING || u.type === UnitType.PAWN) && Math.max(diffX, diffY) <= 1) return true;

                        // Knight
                        if (u.type === UnitType.KNIGHT) {
                            if ((diffX === 1 && diffY === 2) || (diffX === 2 && diffY === 1)) return true;
                        }

                        // Sliding Units
                        let isThreat = false;
                        if (u.type === UnitType.ROOK) isThreat = (x === u.x || y === u.y);
                        else if (u.type === UnitType.BISHOP) isThreat = (diffX === diffY);
                        else if (u.type === UnitType.QUEEN) isThreat = (x === u.x || y === u.y || diffX === diffY);

                        if (isThreat) {
                            // Line of sight check
                            if (this.hasLineOfSight(u.x, u.y, x, y)) return true;
                        }
                    }
                }
            }
        }
        return false;
    }

    // Helper for LoS
    private hasLineOfSight(x1: number, y1: number, x2: number, y2: number): boolean {
        const dx = Math.sign(x2 - x1);
        const dy = Math.sign(y2 - y1);
        let cx = x1 + dx;
        let cy = y1 + dy;
        while (cx !== x2 || cy !== y2) {
            if (this.positionMap.has(`${cx},${cy}`)) return false;
            cx += dx;
            cy += dy;
        }
        return true;
    }

    public getValidMoves(unit: Unit, now: number, checkCooldown: boolean = true): Coords[] {
        if (checkCooldown) {
            const cd = this.getUnitCooldown(unit.type);
            if (now - unit.lastMoveTime < cd) return [];
        }

        const moves: Coords[] = [];
        const { x, y, type, ownerId } = unit;

        const add = (tx: number, ty: number) => {
            // Terrain collision check
            if (WorldGenerator.isBlocking(this.terrainMap, tx, ty)) return false;

            const tid = this.positionMap.get(`${tx},${ty}`);
            if (tid) {
                const target = this.units.get(tid);
                if (target && target.ownerId !== ownerId && !this.isAlly(ownerId, target.ownerId)) {
                    moves.push({ x: tx, y: ty }); // Capture
                }
                return false; // Blocked
            }
            moves.push({ x: tx, y: ty });
            return true;
        };

        const range = 8;

        if (unit.type === UnitType.KING) {
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (dx === 0 && dy === 0) continue;
                    add(unit.x + dx, unit.y + dy);
                }
            }
        } else if (unit.type === UnitType.PAWN) {
            // PAWN: Orthogonal Move / Diagonal Attack
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (dx === 0 && dy === 0) continue;

                    const isDiagonal = Math.abs(dx) === 1 && Math.abs(dy) === 1;
                    const tx = unit.x + dx;
                    const ty = unit.y + dy;

                    // Terrain collision check
                    if (WorldGenerator.isBlocking(this.terrainMap, tx, ty)) continue;

                    // Check direct map instead of using generic 'add' to respect specific rules
                    const tid = this.positionMap.get(`${tx},${ty}`);

                    if (isDiagonal) {
                        // CAPTURE ONLY
                        if (tid) {
                            const target = this.units.get(tid);
                            // Must be enemy and not ally
                            if (target && target.ownerId !== ownerId && !this.isAlly(ownerId, target.ownerId)) {
                                moves.push({ x: tx, y: ty });
                            }
                        }
                    } else {
                        // MOVE ONLY (Cardinal)
                        if (!tid) {
                            moves.push({ x: tx, y: ty });
                        }
                    }
                }
            }
        } else if (unit.type === UnitType.KNIGHT) {
            const jumps = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
            jumps.forEach(([dx, dy]) => add(unit.x + dx, unit.y + dy));
        } else {
            // Sliding
            const dirs = [];
            if (unit.type === UnitType.ROOK || unit.type === UnitType.QUEEN) {
                dirs.push([0, 1], [0, -1], [1, 0], [-1, 0]);
            }
            if (unit.type === UnitType.BISHOP || unit.type === UnitType.QUEEN) {
                dirs.push([1, 1], [1, -1], [-1, 1], [-1, -1]);
            }

            for (const [dx, dy] of dirs) {
                for (let i = 1; i <= range; i++) {
                    if (!add(unit.x + dx * i, unit.y + dy * i)) break;
                }
            }
        }
        return moves;
    }

    public runDirectorAI(gameTime: number) {
        // 1. UPDATE PHASE
        const remaining = this.playersRemaining;
        let newPhase = 'CHAOS';

        if (remaining <= 20) newPhase = 'SUDDEN_DEATH';
        else if (remaining <= 40) newPhase = 'CONVERGENCE';
        else if (remaining <= 60) newPhase = 'HUNT';

        this.directorState.phase = newPhase as any;

        // 2. APPLY RULESETS
        this.directorState.infiniteVision = (newPhase === 'HUNT' || newPhase === 'CONVERGENCE' || newPhase === 'SUDDEN_DEATH');
        this.directorState.centerGravity = (newPhase === 'CONVERGENCE');
        this.directorState.totalWar = (newPhase === 'SUDDEN_DEATH');


        // 4. MANHUNT (Anti-Boredom)
        const human = this.players.get(this.humanId);
        if (human && !human.isEliminated && !this.isAttractMode) {
            const timeSinceCombat = gameTime - (human.lastCombatTime || 0);
            if (timeSinceCombat > 30000) {
                // Player is bored. Send hunters.
                let closestBots: { p: Player, dist: number }[] = [];
                this.players.forEach(p => {
                    if (!p.isHuman && !p.isEliminated && p.id !== ZOMBIE_TEAM_ID) {
                        const dist = Math.hypot(p.centerX - human.centerX, p.centerY - human.centerY);
                        closestBots.push({ p, dist });
                    }
                });

                closestBots.sort((a, b) => a.dist - b.dist);

                // Pick top 2
                for (let i = 0; i < Math.min(2, closestBots.length); i++) {
                    const hunter = closestBots[i].p;
                    hunter.aiState = AIState.VENDETTA;
                    hunter.aiTargetId = this.humanId;
                    if (Math.random() < 0.5) this.botSpeak(hunter, 'VENDETTA', true);
                }

                // Reset timer so we don't spam hunters every second
                human.lastCombatTime = gameTime - 15000;
            }
        }

        if (this.config.gameMode === 'ZOMBIES') {
            // ... existing zombie logic preserved
        }

        // 5. CREDIT SUBSIDY (Endgame Sustainability)
        if (remaining <= 10 && gameTime % 10000 < 100) { // Every ~10 seconds
            this.players.forEach(p => {
                if (!p.isHuman && !p.isEliminated && p.id !== ZOMBIE_TEAM_ID) {
                    p.credits += 1;
                }
            });
        }
    }

}