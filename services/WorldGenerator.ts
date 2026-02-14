/**
 * WorldGenerator - Procedural terrain generation for the game board.
 * 
 * This is a completely isolated service. It only runs when `mapType` is not 'EMPTY'.
 * To enable/disable world generation for a game mode, simply set `config.mapType`.
 */

import { TerrainType } from '../types';

export type MapType = 'EMPTY' | 'FOREST' | 'DESERT' | 'FROZEN';

export interface TerrainTile {
    type: TerrainType;
    icon: string;   // Emoji to render
    color: string;  // Background tint color
}

// Terrain visual definitions
const TERRAIN_DEFS: Record<TerrainType, { icon: string; color: string }> = {
    [TerrainType.GRASS]: { icon: '', color: '' },   // Default, no overlay
    [TerrainType.WALL]: { icon: '🪨', color: '#374151' },  // Dark stone
    [TerrainType.FOREST]: { icon: '🌲', color: '#14532d' },  // Deep green
    [TerrainType.WATER]: { icon: '💧', color: '#1e3a5f' },  // Deep blue
    [TerrainType.SAND]: { icon: '', color: '#92702a' },     // Sandy brown
    [TerrainType.SNOW]: { icon: '', color: '#94a3b8' },     // Cool grey-blue
};

/**
 * Simple 2D value noise for organic terrain patches.
 * Uses a seeded pseudo-random function for reproducibility.
 */
class SeededNoise {
    private seed: number;

    constructor(seed: number) {
        this.seed = seed;
    }

    // Fast hash for 2D coordinates
    private hash(x: number, y: number): number {
        let h = this.seed + x * 374761393 + y * 668265263;
        h = (h ^ (h >>> 13)) * 1274126177;
        h = h ^ (h >>> 16);
        return (h & 0x7fffffff) / 0x7fffffff; // 0..1
    }

    /**
     * Smooth value noise at (x, y) with a given scale.
     * Returns 0..1
     */
    noise2D(x: number, y: number, scale: number = 0.1): number {
        const sx = x * scale;
        const sy = y * scale;
        const ix = Math.floor(sx);
        const iy = Math.floor(sy);
        const fx = sx - ix;
        const fy = sy - iy;

        // Bilinear interpolation of 4 corners
        const a = this.hash(ix, iy);
        const b = this.hash(ix + 1, iy);
        const c = this.hash(ix, iy + 1);
        const d = this.hash(ix + 1, iy + 1);

        // Smoothstep
        const ux = fx * fx * (3 - 2 * fx);
        const uy = fy * fy * (3 - 2 * fy);

        return a * (1 - ux) * (1 - uy) + b * ux * (1 - uy) + c * (1 - ux) * uy + d * ux * uy;
    }
}

export class WorldGenerator {
    /**
     * Generate terrain for the game board.
     * 
     * @param mapType - The type of map to generate ('EMPTY' returns immediately)
     * @param playerPositions - Array of {x, y} center positions of all player armies (for spawn protection)
     * @param seed - Random seed for reproducibility
     * @returns A Map<string, TerrainTile> keyed by "x,y"
     */
    static generate(
        mapType: MapType,
        playerPositions: { x: number; y: number }[],
        seed: number = 42
    ): Map<string, TerrainTile> {
        const terrainMap = new Map<string, TerrainTile>();

        if (mapType === 'EMPTY') {
            return terrainMap; // Empty board - current behavior
        }

        const noise = new SeededNoise(seed);

        // Determine map bounds from player positions (with padding)
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const pos of playerPositions) {
            minX = Math.min(minX, pos.x - 8);
            maxX = Math.max(maxX, pos.x + 8);
            minY = Math.min(minY, pos.y - 4);
            maxY = Math.max(maxY, pos.y + 4);
        }

        // Build a set of protected tiles (player spawn areas)
        const protectedTiles = new Set<string>();
        for (const pos of playerPositions) {
            // Protect a 12x6 area around each player center (army is ~10x3)
            for (let dx = -6; dx <= 6; dx++) {
                for (let dy = -3; dy <= 3; dy++) {
                    protectedTiles.add(`${pos.x + dx},${pos.y + dy}`);
                }
            }
        }

        switch (mapType) {
            case 'FOREST':
                WorldGenerator.generateForest(terrainMap, noise, minX, maxX, minY, maxY, protectedTiles);
                break;
            case 'DESERT':
                WorldGenerator.generateDesert(terrainMap, noise, minX, maxX, minY, maxY, protectedTiles);
                break;
            case 'FROZEN':
                WorldGenerator.generateFrozen(terrainMap, noise, minX, maxX, minY, maxY, protectedTiles);
                break;
        }

        return terrainMap;
    }

    /**
     * FOREST MAP: Clusters of trees with rocky outcrops.
     * Theme: Dense green world with natural chokepoints.
     */
    private static generateForest(
        map: Map<string, TerrainTile>,
        noise: SeededNoise,
        minX: number, maxX: number, minY: number, maxY: number,
        protectedTiles: Set<string>
    ) {
        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                const key = `${x},${y}`;
                if (protectedTiles.has(key)) continue;

                // Layer 1: Forest clusters (large organic blobs)
                const forestNoise = noise.noise2D(x, y, 0.08);
                // Layer 2: Rock outcrops (smaller, rarer)
                const rockNoise = noise.noise2D(x + 500, y + 500, 0.12);

                if (rockNoise > 0.78) {
                    map.set(key, { type: TerrainType.WALL, ...TERRAIN_DEFS[TerrainType.WALL] });
                } else if (forestNoise > 0.62) {
                    map.set(key, { type: TerrainType.FOREST, ...TERRAIN_DEFS[TerrainType.FOREST] });
                }
            }
        }
    }

    /**
     * DESERT MAP: Sandy terrain with scattered rock formations.
     * Theme: Arid with large rock walls creating maze-like corridors.
     */
    private static generateDesert(
        map: Map<string, TerrainTile>,
        noise: SeededNoise,
        minX: number, maxX: number, minY: number, maxY: number,
        protectedTiles: Set<string>
    ) {
        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                const key = `${x},${y}`;
                if (protectedTiles.has(key)) continue;

                const sandNoise = noise.noise2D(x, y, 0.05);
                const rockNoise = noise.noise2D(x + 1000, y + 1000, 0.15);

                if (rockNoise > 0.75) {
                    map.set(key, { type: TerrainType.WALL, ...TERRAIN_DEFS[TerrainType.WALL] });
                } else if (sandNoise > 0.4) {
                    map.set(key, { type: TerrainType.SAND, ...TERRAIN_DEFS[TerrainType.SAND] });
                }
            }
        }
    }

    /**
     * FROZEN MAP: Icy terrain with snowdrifts and frozen lakes.
     * Theme: Snow world with water hazards.
     */
    private static generateFrozen(
        map: Map<string, TerrainTile>,
        noise: SeededNoise,
        minX: number, maxX: number, minY: number, maxY: number,
        protectedTiles: Set<string>
    ) {
        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                const key = `${x},${y}`;
                if (protectedTiles.has(key)) continue;

                const snowNoise = noise.noise2D(x, y, 0.06);
                const lakeNoise = noise.noise2D(x + 2000, y + 2000, 0.1);
                const rockNoise = noise.noise2D(x + 3000, y + 3000, 0.13);

                if (rockNoise > 0.80) {
                    map.set(key, { type: TerrainType.WALL, ...TERRAIN_DEFS[TerrainType.WALL] });
                } else if (lakeNoise > 0.78) {
                    map.set(key, { type: TerrainType.WATER, ...TERRAIN_DEFS[TerrainType.WATER] });
                } else if (snowNoise > 0.45) {
                    map.set(key, { type: TerrainType.SNOW, ...TERRAIN_DEFS[TerrainType.SNOW] });
                }
            }
        }
    }

    /**
     * Check if a terrain tile blocks movement.
     */
    static isBlocking(terrainMap: Map<string, TerrainTile>, x: number, y: number): boolean {
        const tile = terrainMap.get(`${x},${y}`);
        if (!tile) return false;
        return tile.type === TerrainType.WALL || tile.type === TerrainType.WATER;
    }
}
