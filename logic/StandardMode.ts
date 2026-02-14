import { IGameMode } from './IGameMode';
import { GameEngine } from '../services/gameEngine';
import { Unit } from '../types';

export class StandardMode implements IGameMode {
    init(engine: GameEngine): void {
        // No special setup for standard mode
    }

    update(engine: GameEngine, delta: number): void {
        // Standard Director AI handles the game flow
        engine.runDirectorAI(engine.currentTime);
    }

    handleDeath(victim: Unit, attacker: Unit, engine: GameEngine): boolean {
        // Return false to let Engine handle standard loot drops
        return false;
    }

    canAttack(attacker: Unit, target: Unit, engine: GameEngine): boolean {
        // Standard war — anyone can attack anyone (except same team)
        return attacker.ownerId !== target.ownerId;
    }

    drawOverlay(ctx: CanvasRenderingContext2D, engine: GameEngine): void {
        // No overlay in standard mode
    }

    getHUDData(engine: GameEngine) {
        return { label: "ENEMIES", value: engine.playersRemaining, color: '#ff4444' };
    }
}
