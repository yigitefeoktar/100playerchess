import { GameEngine } from '../services/gameEngine';
import { Unit, Player } from '../types';

export interface IGameMode {
    init(engine: GameEngine): void;
    update(engine: GameEngine, delta: number): void;
    handleDeath(victim: Unit, attacker: Unit, engine: GameEngine): boolean;
    canAttack(attacker: Unit, target: Unit, engine: GameEngine): boolean;
    drawOverlay(ctx: CanvasRenderingContext2D, engine: GameEngine): void;
    getHUDData(engine: GameEngine): { label: string, value: string | number, color: string };
}
