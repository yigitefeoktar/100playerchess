import { IGameMode } from './IGameMode';
import { GameEngine } from '../services/gameEngine';
import { Unit, GameEventType } from '../types';
import { COLORS } from '../constants';

const ZOMBIE_TEAM_ID = 'ZOMBIES';
const WAVE_INTERVAL = 30000; // 30 seconds per wave

export class ZombieMode implements IGameMode {
    init(engine: GameEngine): void {
        engine.wave = 0;
        engine.waveTimer = 10000; // First wave in 10s
    }

    update(engine: GameEngine, delta: number): void {
        // Handle wave timer
        engine.waveTimer -= delta;
        if (engine.waveTimer <= 0) {
            engine.wave++;
            engine.waveTimer = WAVE_INTERVAL;
        }

        // Director AI still runs for bot-vs-bot behavior
        engine.runDirectorAI(engine.currentTime);
    }

    handleDeath(victim: Unit, attacker: Unit, engine: GameEngine): boolean {
        // If the attacker is a Zombie, convert the victim instead of killing
        if (attacker.isZombie || attacker.ownerId === ZOMBIE_TEAM_ID) {
            // Convert victim to zombie
            const oldOwnerId = victim.ownerId;
            const oldOwner = engine.players.get(oldOwnerId);

            // Remove unit from old owner's roster
            if (oldOwner) {
                oldOwner.units = oldOwner.units.filter(uid => uid !== victim.id);
            }

            // Convert the unit
            victim.ownerId = ZOMBIE_TEAM_ID;
            victim.isZombie = true;
            victim.hp = 1;
            victim.isDead = false;

            // Add to zombie team roster
            const zombieTeam = engine.players.get(ZOMBIE_TEAM_ID);
            if (zombieTeam) {
                zombieTeam.units.push(victim.id);
            }

            // Push conversion event for visual feedback
            engine.eventQueue.push({
                type: GameEventType.CONVERSION,
                x: victim.x,
                y: victim.y,
                metadata: { color: COLORS.ZOMBIE_GREEN }
            });

            return true; // Mode handled the death — don't do standard loot
        }

        return false; // Non-zombie kills use standard loot
    }

    canAttack(attacker: Unit, target: Unit, engine: GameEngine): boolean {
        // Same team cannot attack each other
        if (attacker.ownerId === target.ownerId) return false;

        // Zombies attack everyone; everyone attacks zombies; survivors fight each other
        return true;
    }

    drawOverlay(ctx: CanvasRenderingContext2D, engine: GameEngine): void {
        // No special overlay for zombie mode
    }

    getHUDData(engine: GameEngine) {
        return { label: "WAVE", value: engine.wave, color: COLORS.ZOMBIE_GREEN };
    }
}
