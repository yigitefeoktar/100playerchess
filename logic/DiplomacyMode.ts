import { IGameMode } from './IGameMode';
import { GameEngine } from '../services/gameEngine';
import { Unit } from '../types';

const PEACE_DURATION = 30000; // 30 second initial armistice

export class DiplomacyMode implements IGameMode {
    init(engine: GameEngine): void {
        // Start with a global peace period
        engine.peaceTimer = PEACE_DURATION;
    }

    update(engine: GameEngine, delta: number): void {
        // Tick down the armistice timer
        if (engine.peaceTimer > 0) {
            engine.peaceTimer -= delta;
            if (engine.peaceTimer < 0) engine.peaceTimer = 0;
        }

        // Director AI still runs
        engine.runDirectorAI(engine.currentTime);
    }

    handleDeath(victim: Unit, attacker: Unit, engine: GameEngine): boolean {
        // Standard loot handling
        return false;
    }

    canAttack(attacker: Unit, target: Unit, engine: GameEngine): boolean {
        // Same team cannot attack
        if (attacker.ownerId === target.ownerId) return false;

        // During armistice, no attacks allowed
        if (engine.peaceTimer > 0) return false;

        // Allies cannot attack each other
        if (engine.isAlly(attacker.ownerId, target.ownerId)) return false;

        return true;
    }

    drawOverlay(ctx: CanvasRenderingContext2D, engine: GameEngine): void {
        // No special overlay for diplomacy mode
    }

    getHUDData(engine: GameEngine) {
        if (engine.peaceTimer > 0) {
            const seconds = Math.ceil(engine.peaceTimer / 1000);
            return { label: "PEACE", value: `${seconds}s`, color: '#00ffff' };
        }
        return { label: "ALLIANCES", value: '', color: '#00ffff' };
    }
}
