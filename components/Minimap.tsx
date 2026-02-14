
import React, { useRef, useEffect, useState } from 'react';
import { GameEngine } from '../services/gameEngine';
import { COLORS, TILE_SIZE, UNIT_ICONS } from '../constants';
import { UnitType, Coords } from '../types';

interface MinimapProps {
    engine: GameEngine;
    onNavigate: (x: number, y: number) => void;
    cameraRef: React.MutableRefObject<Coords>;
    zoomRef: React.MutableRefObject<number>;
    visible: boolean;
    onClose: () => void;
    onOpen: () => void;
}

// World range from center
const WORLD_EXTENT_MINIMIZED = 100; // Original square focus
const WORLD_EXTENT_X_MAXIMIZED = 90;
const WORLD_EXTENT_Y_MAXIMIZED = 60;

export const Minimap: React.FC<MinimapProps> = ({ engine, onNavigate, cameraRef, zoomRef, visible, onClose, onOpen }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number>(0);

    // States for Tactical Mode
    const [isExpanded, setIsExpanded] = useState(false);
    const [showLoot, setShowLoot] = useState(false);
    const [highlightKings, setHighlightKings] = useState(false);

    // Swipe State
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchY, setTouchY] = useState<number | null>(null);
    const isSwiping = useRef(false);

    // Close on ESC
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isExpanded) {
                setIsExpanded(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isExpanded]);

    const render = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Dimensions
        const width = canvas.width;
        const height = canvas.height;

        // 0. Perfectly center the board by calculating the canvas center
        const canvasCx = width / 2;
        const canvasCy = height / 2;


        // Use appropriate extents based on mode
        const worldX = isExpanded ? WORLD_EXTENT_X_MAXIMIZED : WORLD_EXTENT_MINIMIZED;
        const worldY = isExpanded ? WORLD_EXTENT_Y_MAXIMIZED : WORLD_EXTENT_MINIMIZED;

        // Calculate scale factor to fit the world within the canvas
        const scaleX = width / (worldX * 2);
        const scaleY = height / (worldY * 2);
        const scale = Math.min(scaleX, scaleY);

        // CLEAR CANVAS
        ctx.clearRect(0, 0, width, height);



        // 1. Background
        ctx.fillStyle = isExpanded ? 'rgba(10, 10, 20, 0.95)' : 'rgba(15, 23, 42, 0.2)';
        ctx.fillRect(0, 0, width, height);

        // 2. Grid (Faint) - Crosshair lines removed

        // 3. Loot (Optional)
        for (const coin of engine.coins.values()) {
            const mx = coin.x * scale + canvasCx;
            const my = coin.y * scale + canvasCy;

            // Keep it in bounds of the board
            const marginX = worldX * scale;
            const marginY = worldY * scale;
            if (mx < canvasCx - marginX || mx > canvasCx + marginX || my < canvasCy - marginY || my > canvasCy + marginY) continue;


            const size = isExpanded ? 2 : 1;
            ctx.fillRect(mx - size / 2, my - size / 2, size, size);
        }


        const kings: { x: number, y: number, color: string, isHuman: boolean }[] = [];

        // 4. Units
        for (const unit of engine.units.values()) {
            if (unit.isDead) continue;

            const mx = unit.x * scale + canvasCx;
            const my = unit.y * scale + canvasCy;

            // Simple rectangle check for efficiency
            const marginX = worldX * scale;
            const marginY = worldY * scale;
            if (mx < canvasCx - marginX || mx > canvasCx + marginX || my < canvasCy - marginY || my > canvasCy + marginY) continue;

            const player = engine.players.get(unit.ownerId);
            if (!player) continue;

            if (highlightKings && unit.type === UnitType.KING) {
                kings.push({ x: mx, y: my, color: player.color, isHuman: player.isHuman });
            } else {
                ctx.fillStyle = player.color;
                const size = isExpanded ? 2 : 1.5;
                ctx.fillRect(mx - size / 2, my - size / 2, size, size);
            }
        }


        // 5. Kings (High Visibility Layer)
        // Only runs if highlightKings was true and kings were pushed to the array
        const now = Date.now();
        for (const k of kings) {
            if (k.isHuman) {
                // Player King: Cyan Square + White Outline
                ctx.fillStyle = '#06b6d4'; // Cyan 500
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.5;

                const size = isExpanded ? 10 : 6;
                ctx.fillRect(k.x - size / 2, k.y - size / 2, size, size);
                ctx.strokeRect(k.x - size / 2, k.y - size / 2, size, size);
            } else {
                // Enemy King: Red Circle + White Outline + Pulse
                ctx.fillStyle = '#ef4444'; // Red 500
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.5;

                const baseRadius = isExpanded ? 5 : 3;
                // Sine wave pulse
                const pulse = Math.sin(now / 200) * (isExpanded ? 2 : 1);
                const r = baseRadius + Math.max(0, pulse);

                ctx.beginPath();
                ctx.arc(k.x, k.y, r, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }
        }

        // 6. Viewport Camera (White Outline)
        // Only draw viewport rectangle if NOT expanded (Mini mode)
        if (cameraRef.current && !isExpanded) {
            const camX = (cameraRef.current.x / TILE_SIZE);
            const camY = (cameraRef.current.y / TILE_SIZE);

            const viewW = (window.innerWidth / TILE_SIZE) / zoomRef.current;
            const viewH = (window.innerHeight / TILE_SIZE) / zoomRef.current;

            const vx = (camX - viewW / 2) * scale + canvasCx;
            const vy = (camY - viewH / 2) * scale + canvasCy;
            const vw = viewW * scale;
            const vh = viewH * scale;

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.lineWidth = 1;
            ctx.strokeRect(vx, vy, vw, vh);

        }


        requestRef.current = requestAnimationFrame(render);
    };

    useEffect(() => {
        // Stop rendering if hidden and not expanded
        if (!visible && !isExpanded) return;

        requestRef.current = requestAnimationFrame(render);
        return () => cancelAnimationFrame(requestRef.current!);
    }, [isExpanded, showLoot, highlightKings, visible]);

    // Swipe Handling
    const onTouchStart = (e: React.TouchEvent) => {
        setTouchStart(e.targetTouches[0].clientX);
        setTouchY(e.targetTouches[0].clientY);
        isSwiping.current = false;
    };

    const onTouchEnd = (e: React.TouchEvent) => {
        if (touchStart === null || touchY === null) return;
        const touchEnd = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;
        const diff = touchStart - touchEnd;
        const diffY = Math.abs(touchY - touchEndY);

        // Ignore vertical swipes
        if (diffY > Math.abs(diff)) {
            setTouchStart(null);
            setTouchY(null);
            return;
        }

        const SWIPE_THRESHOLD = 50;

        // Swipe Left (Open)
        if (diff > SWIPE_THRESHOLD && !visible) {
            onOpen();
            isSwiping.current = true;
        }
        // Swipe Right (Close)
        else if (diff < -SWIPE_THRESHOLD && visible) {
            onClose();
            isSwiping.current = true;
        }
        setTouchStart(null);
        setTouchY(null);
    };

    const handleClick = (e: React.MouseEvent) => {
        // ... (preserving guards)
        if (isSwiping.current) { isSwiping.current = false; return; }
        if (isExpanded) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();

        // Minimized is always square WORLD_EXTENT_MINIMIZED
        const worldX = WORLD_EXTENT_MINIMIZED;
        const worldY = WORLD_EXTENT_MINIMIZED;

        const boardWidth = rect.width;
        const boardHeight = rect.height;
        const scaleX = boardWidth / (worldX * 2);
        const scaleY = boardHeight / (worldY * 2);
        const scale = Math.min(scaleX, scaleY);

        // Calculate the same origin used in render
        const canvasCx = boardWidth / 2;
        const canvasCy = boardHeight / 2;

        const mx = e.clientX - rect.left - canvasCx;
        const my = e.clientY - rect.top - canvasCy;

        const wx = mx / scale;
        const wy = my / scale;

        onNavigate(wx * TILE_SIZE, wy * TILE_SIZE);
    };


    return (
        <>
            <div
                className={`
                ${isExpanded
                        ? "fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                        : "absolute bottom-4 right-4 z-20"}
                transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]
                ${visible ? 'translate-x-0' : 'translate-x-[150%]'}
            `}
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
            >
                <div
                    className={`relative glass-panel overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'rounded-lg' : 'rounded-lg'
                        }`}
                    style={{
                        width: isExpanded ? '90vw' : '14rem',
                        height: isExpanded ? '90vh' : '14rem'
                    }}
                >
                    <canvas
                        ref={canvasRef}
                        width={isExpanded ? window.innerWidth * 0.9 : 224}
                        height={isExpanded ? window.innerHeight * 0.9 : 224}
                        className="block cursor-crosshair w-full h-full"
                        onClick={handleClick}
                    />

                    {/* Controls Overlay */}
                    <div className="absolute top-2 right-2 flex gap-2 pointer-events-none">

                        {/* Filter Controls Group */}
                        <div className="pointer-events-auto flex items-center bg-black/40 rounded border border-cyan-500/20 shadow h-7">

                            {/* Loot Toggle */}
                            <label className="flex items-center justify-center px-2 h-full cursor-pointer transition-colors gap-1.5" title="Show Loot">
                                <input
                                    type="checkbox"
                                    checked={showLoot}
                                    onChange={(e) => setShowLoot(e.target.checked)}
                                    className="accent-cyan-500 w-3 h-3 cursor-pointer rounded-sm"
                                />
                                {/* Small Coin Icon */}
                                <div className="w-2.5 h-2.5 rounded-full bg-amber-400 ring-1 ring-amber-600/50 shadow-sm"></div>
                            </label>

                            {/* Separator */}
                            <div className="w-px h-3 bg-cyan-500/20"></div>

                            {/* King Toggle */}
                            <label className="flex items-center justify-center px-2 h-full cursor-pointer transition-colors gap-1.5" title="Highlight Kings">
                                <input
                                    type="checkbox"
                                    checked={highlightKings}
                                    onChange={(e) => setHighlightKings(e.target.checked)}
                                    className="accent-cyan-500 w-3 h-3 cursor-pointer rounded-sm"
                                />
                                {/* Small King Icon */}
                                <span className="text-slate-200 text-xs leading-none transform -translate-y-[1px]">{UNIT_ICONS[UnitType.KING]}</span>
                            </label>

                        </div>

                        {/* Maximize/Minimize Toggle */}
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="pointer-events-auto bg-black/40 hover:bg-black/60 text-cyan-400 w-7 h-7 flex items-center justify-center rounded border border-cyan-500/20 shadow transition-colors"
                            title={isExpanded ? "Minimize (ESC)" : "Maximize"}
                        >
                            {isExpanded ? (
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3" /><path d="M21 8h-3a2 2 0 0 1-2-2V3" /><path d="M3 16h3a2 2 0 0 1 2 2v3" /><path d="M16 21v-3a2 2 0 0 1 2-2h3" /></svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6" /><path d="M9 21H3v-6" /><path d="M21 3l-7 7" /><path d="M3 21l7-7" /></svg>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Invisible Swipe Trigger (Only when Hidden) */}
            {!visible && (
                <div
                    className="absolute bottom-4 right-0 w-8 h-56 z-20 pointer-events-auto"
                    onTouchStart={onTouchStart}
                    onTouchEnd={onTouchEnd}
                />
            )}
        </>
    );
};
