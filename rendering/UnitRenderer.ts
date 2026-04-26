/**
 * UnitRenderer — Chess piece rendering using bundled web fonts.
 *
 * Uses Unicode chess characters rendered with fillText/strokeText.
 * Hardcoded to use FreeSans with Classic Flat styling for 100 Player Chess.
 * Each type+color combo is cached to an offscreen sprite for performance.
 */

import { UnitType } from '../types';

export interface ChessFont {
    id: string;
    label: string;
    family: string;
    yOffset?: number;
}

const DEFAULT_FONT: ChessFont = {
    id: 'free-sans',
    label: 'FreeSans',
    family: "'FreeSans', sans-serif",
    yOffset: 0
};

export function getDefaultFont(): ChessFont {
    return DEFAULT_FONT;
}

// ─── Unicode Mapping ───────────────────────────────────────

const PIECE_CHARS: Record<UnitType, string> = {
    [UnitType.PAWN]: '♟',
    [UnitType.KNIGHT]: '♞',
    [UnitType.ROOK]: '♜',
    [UnitType.BISHOP]: '♝',
    [UnitType.QUEEN]: '♛',
    [UnitType.KING]: '♚',
    [UnitType.VAULT]: '❖',
};

const ZOMBIE_CHARS: Record<UnitType, string> = {
    [UnitType.PAWN]: '♟',
    [UnitType.KNIGHT]: '♞',
    [UnitType.ROOK]: '♜',
    [UnitType.BISHOP]: '♝',
    [UnitType.QUEEN]: '♛',
    [UnitType.KING]: '♚',
    [UnitType.VAULT]: '❖',
};

// ─── Sprite cache ──────────────────────────────────────────

const SPRITE_SIZE = 128;
const spriteCache = new Map<string, HTMLCanvasElement>();
const MAX_CACHE = 2000;

function renderSprite(
    type: UnitType,
    color: string,
    isZombie: boolean,
    fontFamily: string,
    yOffset: number
): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = SPRITE_SIZE;
    canvas.height = SPRITE_SIZE;
    const ctx = canvas.getContext('2d')!;

    const char = isZombie ? ZOMBIE_CHARS[type] : PIECE_CHARS[type];
    const fontSize = SPRITE_SIZE * 0.78;
    const cx = SPRITE_SIZE / 2;
    const cy = SPRITE_SIZE / 2 + (yOffset || 0);

    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Setup baked-in glow to fall *behind* the black stroke
    ctx.shadowColor = color;
    ctx.shadowBlur = fontSize * 0.15; // Scale glow with font size
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Default flat style (shadow will cast outwardly from this shape)
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.lineWidth = fontSize * 0.06;
    ctx.lineJoin = 'round';
    ctx.strokeText(char, cx, cy);

    // Reset shadow so the inner fill doesn't cast a muddy shadow over the stroke
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // Fill body (cleanly inside the black stroke)
    ctx.fillStyle = color;
    ctx.fillText(char, cx, cy);

    return canvas;
}

function getSprite(
    type: UnitType,
    color: string,
    isZombie: boolean,
    font: ChessFont
): HTMLCanvasElement {
    const key = `${type}-${color}-${isZombie ? 'z' : 'n'}-${font.id}`;
    let cached = spriteCache.get(key);
    if (cached) return cached;

    if (spriteCache.size >= MAX_CACHE) {
        const first = spriteCache.keys().next().value;
        if (first) spriteCache.delete(first);
    }

    const sprite = renderSprite(type, color, isZombie, font.family, font.yOffset || 0);
    spriteCache.set(key, sprite);
    return sprite;
}

// ─── Public API ────────────────────────────────────────────

export function drawUnit(
    ctx: CanvasRenderingContext2D,
    type: UnitType,
    cx: number, cy: number,
    size: number, color: string,
    isZombie: boolean = false
) {
    const sprite = getSprite(type, color, isZombie, DEFAULT_FONT);
    const half = size / 2;
    ctx.drawImage(sprite, cx - half, cy - half, size, size);
}

export function clearSpriteCache() {
    spriteCache.clear();
}
