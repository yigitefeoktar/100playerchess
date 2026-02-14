import { IGameMode } from './IGameMode';
import { GameEngine } from '../services/gameEngine';
import { Unit, AIState, BotPersonality } from '../types';
import { FACTION_COLORS } from '../constants';

export class SandboxMode implements IGameMode {
    isSimulationRunning: boolean = false;

    init(engine: GameEngine): void {
        // Clear the entire map (units + coins)
        engine.clearMap();

        // Pause the game — editor starts frozen
        engine.setPaused(true);

        const now = engine.currentTime;

        // Create sandbox teams from shared constants
        // Maps 'red' -> 'sandbox-red', etc.
        const teams = FACTION_COLORS.map(fc => ({
            id: `sandbox-${fc.id}`,
            color: fc.hex,
            isHuman: false // All teams are bots in Sandbox
        }));

        // Clear old players and register sandbox teams
        engine.players.clear();
        for (const team of teams) {
            engine.players.set(team.id, {
                id: team.id,
                isHuman: team.isHuman,
                color: team.color,
                centerX: 0,
                centerY: 0,
                isEliminated: false,
                units: [],
                credits: 0,
                totalCollected: 0,
                materialScore: 0,
                peakMaterial: 0,
                kills: 0,
                kingsKilled: 0,
                lastScoreTime: now,
                aiState: AIState.SIEGE,
                allies: [],
                enemies: [],
                diplomacyState: 'WAR',
                personality: team.isHuman ? BotPersonality.NONE : BotPersonality.AGGRESSOR,
                chatMessage: null,
                chatTimer: 0,
                lastActionTime: 0,
                actionDelay: team.isHuman ? 200 : 50, // Bots react instantly
                lastCombatTime: now,
                lastMovedLane: 0,
                combatStartTime: now,
                totalWarActive: false,
            });
        }

        // Assign human to spectator (no gameplay impact)
        engine.humanId = 'spectator';
    }

    update(engine: GameEngine, delta: number): void {
        if (!this.isSimulationRunning) {
            // Time is frozen — do nothing
            return;
        }

        // Simulation is LIVE — run director AI
        engine.runDirectorAI(engine.currentTime);

        // Override: Force all bots to AGGRESSOR with instant reactions
        engine.players.forEach(player => {
            if (!player.isHuman) {
                player.personality = BotPersonality.AGGRESSOR;
                player.actionDelay = 50;
            }
        });
    }

    handleDeath(victim: Unit, attacker: Unit, engine: GameEngine): boolean {
        // Standard death logic — let engine handle it
        return false;
    }

    canAttack(attacker: Unit, target: Unit, engine: GameEngine): boolean {
        // Free for all — anyone can attack anyone (except same team)
        return attacker.ownerId !== target.ownerId;
    }

    drawOverlay(ctx: CanvasRenderingContext2D, engine: GameEngine): void {
        // No overlay in Phase 1
    }

    getHUDData(engine: GameEngine) {
        if (!this.isSimulationRunning) {
            return { label: 'EDITOR', value: 'PAUSED', color: '#FFD700' };
        }
        return { label: 'SIMULATION', value: 'LIVE', color: '#00FF00' };
    }
}
