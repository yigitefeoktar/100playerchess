/**
 * TerrainRenderer — Canvas path drawing functions for terrain props.
 * 
 * All functions draw within a tile-sized area at (x, y) world coordinates,
 * transformed to screen space by the caller (GameCanvas).
 * 
 * These are PURE drawing functions: no state, no side effects.
 */

// ============================================================
// GROUND TILES (flat, drawn under everything)
// ============================================================

/**
 * Draw a sand tile — warm textured ground.
 */
export function drawSandGround(
    ctx: CanvasRenderingContext2D,
    sx: number, sy: number,
    size: number
) {
    ctx.fillStyle = '#c4a265';
    ctx.fillRect(sx, sy, size, size);
    // Subtle dot texture
    ctx.fillStyle = 'rgba(180, 140, 60, 0.3)';
    for (let i = 0; i < 6; i++) {
        const dx = (((i * 7 + 3) % 11) / 11) * size;
        const dy = (((i * 13 + 5) % 11) / 11) * size;
        ctx.beginPath();
        ctx.arc(sx + dx, sy + dy, size * 0.04, 0, Math.PI * 2);
        ctx.fill();
    }
}

/**
 * Draw a snow tile — cool white-blue ground.
 */
export function drawSnowGround(
    ctx: CanvasRenderingContext2D,
    sx: number, sy: number,
    size: number
) {
    ctx.fillStyle = '#d4dce8';
    ctx.fillRect(sx, sy, size, size);
    // Sparkle dots
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    for (let i = 0; i < 4; i++) {
        const dx = (((i * 11 + 2) % 9) / 9) * size;
        const dy = (((i * 7 + 4) % 9) / 9) * size;
        ctx.beginPath();
        ctx.arc(sx + dx, sy + dy, size * 0.03, 0, Math.PI * 2);
        ctx.fill();
    }
}

/**
 * Draw a grass tile — forest floor.
 */
export function drawGrassGround(
    ctx: CanvasRenderingContext2D,
    sx: number, sy: number,
    size: number
) {
    ctx.fillStyle = '#2d5a1e';
    ctx.fillRect(sx, sy, size, size);
}

// ============================================================
// VERTICAL PROPS (depth-sorted with units)
// ============================================================

/**
 * Draw a stylized pine tree — depth-sorted prop.
 * Drawn as 3 overlapping triangles with a trunk.
 * The "base" of the tree is at (sx + size/2, sy + size) — bottom of tile.
 */
export function drawTree(
    ctx: CanvasRenderingContext2D,
    sx: number, sy: number,
    size: number
) {
    const cx = sx + size * 0.5;
    const base = sy + size;
    const w = size * 0.7;

    // Trunk
    ctx.fillStyle = '#5a3825';
    ctx.fillRect(cx - size * 0.08, base - size * 0.3, size * 0.16, size * 0.3);

    // Bottom triangle (largest, darkest)
    ctx.fillStyle = '#1a6b2a';
    ctx.beginPath();
    ctx.moveTo(cx, base - size * 1.1);
    ctx.lineTo(cx - w * 0.55, base - size * 0.25);
    ctx.lineTo(cx + w * 0.55, base - size * 0.25);
    ctx.closePath();
    ctx.fill();

    // Middle triangle
    ctx.fillStyle = '#22883a';
    ctx.beginPath();
    ctx.moveTo(cx, base - size * 1.35);
    ctx.lineTo(cx - w * 0.45, base - size * 0.55);
    ctx.lineTo(cx + w * 0.45, base - size * 0.55);
    ctx.closePath();
    ctx.fill();

    // Top triangle (smallest, lightest)
    ctx.fillStyle = '#2ea84e';
    ctx.beginPath();
    ctx.moveTo(cx, base - size * 1.55);
    ctx.lineTo(cx - w * 0.3, base - size * 0.85);
    ctx.lineTo(cx + w * 0.3, base - size * 0.85);
    ctx.closePath();
    ctx.fill();
}

/**
 * Draw a mountain/rock wall — depth-sorted prop.
 * Tall sprite (~1.5 tiles) that extends upward, creating visual overlap.
 */
export function drawMountain(
    ctx: CanvasRenderingContext2D,
    sx: number, sy: number,
    size: number
) {
    const cx = sx + size * 0.5;
    const base = sy + size;
    const w = size * 0.9;
    const h = size * 1.6;

    // Main body — dark face
    ctx.fillStyle = '#4a5568';
    ctx.beginPath();
    ctx.moveTo(cx, base - h);            // Peak
    ctx.lineTo(cx + w * 0.5, base);       // Right base
    ctx.lineTo(cx - w * 0.5, base);       // Left base
    ctx.closePath();
    ctx.fill();

    // Light face (right side highlight)
    ctx.fillStyle = '#718096';
    ctx.beginPath();
    ctx.moveTo(cx, base - h);            // Peak
    ctx.lineTo(cx + w * 0.5, base);       // Right base
    ctx.lineTo(cx + w * 0.15, base);      // Slight offset
    ctx.closePath();
    ctx.fill();

    // Snow cap
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.moveTo(cx, base - h);
    ctx.lineTo(cx - w * 0.15, base - h + size * 0.25);
    ctx.lineTo(cx + w * 0.15, base - h + size * 0.25);
    ctx.closePath();
    ctx.fill();
}

/**
 * Draw water — animated with wave lines.
 */
export function drawWater(
    ctx: CanvasRenderingContext2D,
    sx: number, sy: number,
    size: number,
    time: number
) {
    // Base water fill
    ctx.fillStyle = 'rgba(30, 80, 140, 0.85)';
    ctx.fillRect(sx, sy, size, size);

    // Animated wave lines
    ctx.strokeStyle = 'rgba(100, 180, 255, 0.4)';
    ctx.lineWidth = 1;
    const waveOffset = (time * 0.002) % (Math.PI * 2);
    for (let i = 0; i < 3; i++) {
        const wy = sy + size * (0.25 + i * 0.25);
        ctx.beginPath();
        for (let px = 0; px <= size; px += 2) {
            const wave = Math.sin((px / size) * Math.PI * 2 + waveOffset + i) * size * 0.04;
            if (px === 0) {
                ctx.moveTo(sx + px, wy + wave);
            } else {
                ctx.lineTo(sx + px, wy + wave);
            }
        }
        ctx.stroke();
    }
}

/**
 * Draw a road tile — grey stone path.
 */
export function drawRoad(
    ctx: CanvasRenderingContext2D,
    sx: number, sy: number,
    size: number
) {
    // Road surface
    ctx.fillStyle = '#6b7280';
    ctx.fillRect(sx + size * 0.1, sy, size * 0.8, size);

    // Center line (dashed)
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 1;
    ctx.setLineDash([size * 0.15, size * 0.1]);
    ctx.beginPath();
    ctx.moveTo(sx + size * 0.5, sy);
    ctx.lineTo(sx + size * 0.5, sy + size);
    ctx.stroke();
    ctx.setLineDash([]);
}

/**
 * Draw a mine building — pickaxe icon on a brown structure.
 * ownerColor tints the flag on top.
 */
export function drawMine(
    ctx: CanvasRenderingContext2D,
    sx: number, sy: number,
    size: number,
    ownerColor?: string
) {
    const cx = sx + size * 0.5;
    const base = sy + size;

    // Mine entrance (dark arch)
    ctx.fillStyle = '#3d2b1f';
    ctx.fillRect(sx + size * 0.15, base - size * 0.7, size * 0.7, size * 0.7);

    // Entrance hole
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(cx, base - size * 0.35, size * 0.2, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(cx - size * 0.2, base - size * 0.35, size * 0.4, size * 0.35);

    // Wooden support beams
    ctx.strokeStyle = '#8b6914';
    ctx.lineWidth = size * 0.06;
    ctx.beginPath();
    ctx.moveTo(sx + size * 0.2, base);
    ctx.lineTo(sx + size * 0.2, base - size * 0.65);
    ctx.moveTo(sx + size * 0.8, base);
    ctx.lineTo(sx + size * 0.8, base - size * 0.65);
    ctx.moveTo(sx + size * 0.15, base - size * 0.65);
    ctx.lineTo(sx + size * 0.85, base - size * 0.65);
    ctx.stroke();

    // Flag (colored by owner)
    if (ownerColor) {
        ctx.fillStyle = ownerColor;
        ctx.beginPath();
        ctx.moveTo(cx, base - size * 0.9);
        ctx.lineTo(cx + size * 0.2, base - size * 0.8);
        ctx.lineTo(cx, base - size * 0.7);
        ctx.closePath();
        ctx.fill();
        // Flagpole
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx, base - size * 0.65);
        ctx.lineTo(cx, base - size * 0.95);
        ctx.stroke();
    }
}

/**
 * Draw a factory building — building with gear icon.
 * ownerColor tints the roof.
 */
export function drawFactory(
    ctx: CanvasRenderingContext2D,
    sx: number, sy: number,
    size: number,
    ownerColor?: string
) {
    const base = sy + size;

    // Main building body
    ctx.fillStyle = '#555b63';
    ctx.fillRect(sx + size * 0.1, base - size * 0.8, size * 0.8, size * 0.8);

    // Roof (colored by owner)
    ctx.fillStyle = ownerColor || '#777';
    ctx.beginPath();
    ctx.moveTo(sx + size * 0.05, base - size * 0.8);
    ctx.lineTo(sx + size * 0.5, base - size * 1.2);
    ctx.lineTo(sx + size * 0.95, base - size * 0.8);
    ctx.closePath();
    ctx.fill();

    // Door
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(sx + size * 0.35, base - size * 0.35, size * 0.3, size * 0.35);

    // Window
    ctx.fillStyle = '#87ceeb';
    ctx.fillRect(sx + size * 0.55, base - size * 0.7, size * 0.2, size * 0.15);

    // Chimney
    ctx.fillStyle = '#444';
    ctx.fillRect(sx + size * 0.7, base - size * 1.3, size * 0.12, size * 0.35);

    // Smoke (small circles)
    ctx.fillStyle = 'rgba(200, 200, 200, 0.4)';
    ctx.beginPath();
    ctx.arc(sx + size * 0.76, base - size * 1.35, size * 0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sx + size * 0.8, base - size * 1.45, size * 0.05, 0, Math.PI * 2);
    ctx.fill();
}
