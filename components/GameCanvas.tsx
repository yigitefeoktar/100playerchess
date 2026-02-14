// ... (imports remain the same)
import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { GameEngine } from '../services/gameEngine';
import { TILE_SIZE, COLORS, UNIT_ICONS, ZOMBIE_ICONS, COOLDOWNS } from '../constants';
import { Coords, SelectionBox, UnitType, GameEventType, TerrainType } from '../types';
import { useSound } from '../sound';

export interface GameCanvasRef {
    resetCamera: () => void;
    setCamera: (x: number, y: number) => void;
    clearSelection: () => void;
}

interface SandboxBrush {
    team: string;
    unit: UnitType;
    size: number;
    shape: 'square' | 'circle';
}

interface GameCanvasProps {
    engine: GameEngine;
    setStats: (stats: any) => void;
    shopSelection: UnitType | null;
    onUnitPlaced?: () => void;
    shopButtonPos: { x: number, y: number } | null;
    cameraRef: React.MutableRefObject<Coords>;
    zoomRef: React.MutableRefObject<number>;
    isShopOpen: boolean;
    onCloseShop: () => void;
    isGameOver: boolean;
    isLightMode: boolean;
    isResignation?: boolean;
    onRightClickEntity?: (x: number, y: number, unitId: string) => void;
    onOpenShop?: () => void;
    sandboxBrush?: SandboxBrush;
}

// ... (RenderEntity and Particle interfaces remain the same)
interface RenderEntity {
    x: number; // Pixels
    y: number; // Pixels
    bumpX: number; // For attack animation
    bumpY: number;
    flash: number; // For conversion animation (0.0 to 1.0)
    flashColor?: string; // Color of the flash (default white)
    isFlying?: boolean; // True if currently flying from shop to board
}

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    color: string;
    size: number;
    text?: string;
}

const GameCanvasComponent = forwardRef<GameCanvasRef, GameCanvasProps>(({ engine, setStats, shopSelection, onUnitPlaced, shopButtonPos, cameraRef, zoomRef, isShopOpen, onCloseShop, isGameOver, isLightMode, isResignation, onRightClickEntity, onOpenShop, sandboxBrush }, ref) => {
    const { playSound } = useSound();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number>(0);
    // REMOVED camera state for performance: Using cameraRef.current directly
    const [selectionBox, setSelectionBox] = useState<SelectionBox>(null);
    const selectedUnitIds = useRef<Set<string>>(new Set());
    const frameCount = useRef(0);
    const lastTickSoundTime = useRef(0); // For audio throttling
    const lastBoughtTile = useRef<string | null>(null); // For swipe-to-buy tracking
    const swipeMode = useRef<'NONE' | 'PAN' | 'PURCHASE' | 'SANDBOX_PAINT' | 'SANDBOX_ERASE'>('NONE');
    const mouseWorldPos = useRef<Coords | null>(null); // For sandbox ghost brush
    const lastPaintedGridPos = useRef<Coords | null>(null); // For continuous painting interpolation
    const sandboxPaintButton = useRef<number>(0); // 0=left, 2=right
    const lastClickTime = useRef(0);
    const lastClickPos = useRef<Coords | null>(null);

    // Visual State
    const renderEntities = useRef<Map<string, RenderEntity>>(new Map());
    const particles = useRef<Particle[]>([]);
    const validSpawnTiles = useRef<Coords[]>([]);



    // Cache for font vertical centering offsets (Nudge down to fix visual center)
    const glyphOffsets = useRef<Record<string, number>>({
        [UnitType.PAWN]: 3,
        [UnitType.ROOK]: 3,
        [UnitType.KNIGHT]: 3,
        [UnitType.BISHOP]: 3,
        [UnitType.QUEEN]: 3,
        [UnitType.KING]: 3,
        [UnitType.VAULT]: 3,
    });

    // Camera Control State
    const isCameraLocked = useRef(true);
    const panTarget = useRef<Coords | null>(null); // Target for smooth camera animation
    const keysPressed = useRef<Set<string>>(new Set());
    const isPanning = useRef(false);

    // Momentum State
    const panVelocity = useRef<{ x: number, y: number }>({ x: 0, y: 0 });
    const lastInputTime = useRef<number>(0);

    // Zoom State
    const ZOOM_MIN = 0.2;
    const ZOOM_MAX = 3.0;

    // Mouse tracking
    const isDragging = useRef(false);
    const ignoreNextClick = useRef(false); // New: To prevent onClick firing after a drag
    const dragStart = useRef<Coords>({ x: 0, y: 0 });
    const lastMousePos = useRef<Coords | null>(null); // Track last mouse position for pan delta

    // Touch tracking
    const touchStartClientPos = useRef<{ x: number, y: number } | null>(null); // Screen coords for tap detection
    const isPinching = useRef(false);
    const lastPinchDistance = useRef(0);
    const lastPinchCenter = useRef<{ x: number, y: number } | null>(null);
    const lastTouchPos = useRef<{ x: number, y: number } | null>(null); // For panning delta

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
        resetCamera: () => {
            isCameraLocked.current = true;
            panTarget.current = null;
            panVelocity.current = { x: 0, y: 0 };
        },
        setCamera: (x: number, y: number) => {
            isCameraLocked.current = false;
            panTarget.current = { x, y }; // Set target for smooth camera logic in render loop
            panVelocity.current = { x: 0, y: 0 };
        },
        clearSelection: () => {
            selectedUnitIds.current.clear();
        }
    }));

    // Shared Pan Logic to ensure identical feel for Mouse, 1-Finger, and 2-Finger
    const applyPan = (dx: number, dy: number) => {
        if (engine.isAttractMode) return; // Disable pan in attract mode

        isCameraLocked.current = false;
        panTarget.current = null; // Stop Animation

        const vx = -dx / zoomRef.current;
        const vy = -dy / zoomRef.current;

        const prev = cameraRef.current;
        cameraRef.current = {
            x: prev.x + vx,
            y: prev.y + vy
        };

        // Damped momentum
        panVelocity.current = { x: vx * 0.80, y: vy * 0.80 };
        lastInputTime.current = Date.now();
    };

    // ... (Input Event Listeners for Keyboard - NO CHANGE)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (engine.isAttractMode) return; // Disable keyboard in attract mode

            keysPressed.current.add(e.key.toLowerCase());
            const moveKeys = ['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright'];
            if (moveKeys.includes(e.key.toLowerCase())) {
                isCameraLocked.current = false;
                panTarget.current = null; // Interrupt animation
                panVelocity.current = { x: 0, y: 0 };
            }
            if (e.code === 'Space') {
                isCameraLocked.current = true;
                panTarget.current = null;
                panVelocity.current = { x: 0, y: 0 };
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (engine.isAttractMode) return;
            keysPressed.current.delete(e.key.toLowerCase());
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [engine.isAttractMode]);

    // ... (Update Valid Spawns & Camera Update Loop - NO CHANGE)
    useEffect(() => {
        if (shopSelection) {
            validSpawnTiles.current = engine.getValidSpawnTiles(engine.humanId);
        } else {
            validSpawnTiles.current = [];
        }
    }, [shopSelection, engine]);

    // Physics & Camera loop is now integrated into the main render() call via requestAnimationFrame
    // This removes the 16ms setInterval bottleneck
    useEffect(() => {
        if (shopSelection) {
            validSpawnTiles.current = engine.getValidSpawnTiles(engine.humanId);
        } else {
            validSpawnTiles.current = [];
        }
    }, [shopSelection, engine]);

    // ... (Input Handlers - NO CHANGE)
    const getWorldPos = (clientX: number, clientY: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const sx = clientX - rect.left;
        const sy = clientY - rect.top;

        const z = zoomRef.current;
        const wx = (sx - canvas.width / 2) / z + cameraRef.current.x;
        const wy = (sy - canvas.height / 2) / z + cameraRef.current.y;

        return { x: wx, y: wy };
    };

    const getTilePos = (clientX: number, clientY: number) => {
        const w = getWorldPos(clientX, clientY);
        return {
            x: Math.floor(w.x / TILE_SIZE),
            y: Math.floor(w.y / TILE_SIZE)
        };
    };

    // ... (handleUnifiedClick Updated for Fixed Interaction)
    const handleUnifiedClick = (clientX: number, clientY: number, button: number, e?: React.MouseEvent | React.TouchEvent) => {
        if (engine.config.gameMode === 'SANDBOX') return;

        const now = Date.now();
        const t = getTilePos(clientX, clientY);
        const isDoubleClick = now - lastClickTime.current < 300 &&
            lastClickPos.current &&
            lastClickPos.current.x === t.x &&
            lastClickPos.current.y === t.y;

        lastClickTime.current = now;
        lastClickPos.current = t;

        // 0. DOUBLE CLICK ON EMPTY TILE -> OPEN SHOP
        if (!isShopOpen && isDoubleClick) {
            const unitId = engine.positionMap.get(`${t.x},${t.y}`);
            if (!unitId) {
                if (onOpenShop) {
                    onOpenShop();
                    playSound('select');
                    return;
                }
            }
        }

        // 1. SHOP INTERACTION (Prioritized)
        if (isShopOpen) {
            if (shopSelection) {
                const isValid = validSpawnTiles.current.some(vt => vt.x === t.x && vt.y === t.y);
                if (isValid) {
                    const id = engine.buyUnit(engine.humanId, shopSelection, t.x, t.y);
                    if (id) {
                        // REFRESH VALID SPAWNS IMMEDIATELY FOR CHAIN BUILDING
                        validSpawnTiles.current = engine.getValidSpawnTiles(engine.humanId);

                        if (onUnitPlaced) onUnitPlaced();

                        // Auto-close shop if out of credits
                        const player = engine.players.get(engine.humanId);
                        if (player && player.credits < 2) {
                            if (onCloseShop) onCloseShop();
                        }
                    }
                } else {
                    // Invalid placement location

                    // Logic to prevent closing if clicking a just-bought unit
                    const unitId = engine.positionMap.get(`${t.x},${t.y}`);
                    const existingUnit = unitId ? engine.units.get(unitId) : undefined;
                    let allowClose = true;

                    if (existingUnit && existingUnit.ownerId === engine.humanId) {
                        // If it was created/moved in the last 1000ms, ignore the close command
                        if (engine.currentTime - existingUnit.lastMoveTime < 1000) {
                            allowClose = false;
                        }
                    }

                    if (allowClose && onCloseShop) onCloseShop();
                }
            } else {
                if (onCloseShop) onCloseShop();
            }
            return;
        }

        // 2. UNIFIED GAME INTERACTION
        const unitId = engine.positionMap.get(`${t.x},${t.y}`);
        const targetUnit = unitId ? engine.units.get(unitId) : undefined;

        const hasSelection = selectedUnitIds.current.size > 0;

        if (hasSelection) {
            const selectedId = Array.from(selectedUnitIds.current)[0];

            // 2A. Clicked the already selected unit? KEEP SELECTION.
            if (targetUnit && targetUnit.id === selectedId) {
                return;
            }

            const moves = engine.getUnitPossibleMoves(selectedId);
            const isCommand = moves.some(m => m.x === t.x && m.y === t.y);

            if (isCommand) {
                // 2B. Clicked a valid move tile? EXECUTE & KEEP SELECTION.
                engine.issueCommand(Array.from(selectedUnitIds.current), t.x, t.y);
                playSound('move');
            } else {
                // 2C. Invalid Command

                // If clicked another friendly unit -> SWITCH SELECTION
                if (targetUnit && targetUnit.ownerId === engine.humanId) {
                    selectedUnitIds.current = new Set([targetUnit.id]);
                    playSound('select');
                } else {
                    // Clicked Empty/Enemy (Invalid) -> DESELECT
                    selectedUnitIds.current.clear();
                    playSound('click');

                    // Context Menu Logic
                    if (engine.config.gameMode === 'DIPLOMACY' && targetUnit && onRightClickEntity && button === 2) {
                        const owner = engine.players.get(targetUnit.ownerId);
                        if (owner && !owner.isHuman) {
                            if (e) { e.preventDefault(); e.stopPropagation(); }
                            onRightClickEntity(clientX, clientY, owner.id);
                        }
                    }
                }
            }
        } else {
            // 3. NO SELECTION
            if (targetUnit && targetUnit.ownerId === engine.humanId) {
                // SELECT FRIENDLY
                selectedUnitIds.current = new Set([targetUnit.id]);
                playSound('select');
            } else {
                // Clicked Empty -> Any action? No. Error sound?
                playSound('error');
                // Context Menu Check
                if (engine.config.gameMode === 'DIPLOMACY' && targetUnit && onRightClickEntity && button === 2) {
                    const owner = engine.players.get(targetUnit.ownerId);
                    if (owner && !owner.isHuman) {
                        if (e) { e.preventDefault(); e.stopPropagation(); }
                        onRightClickEntity(clientX, clientY, owner.id);
                    }
                }
            }
        }
    };

    // --- Sandbox Brush Helpers ---
    const getBrushTiles = (centerX: number, centerY: number, brush: SandboxBrush): Coords[] => {
        const tiles: Coords[] = [];
        const half = Math.floor(brush.size / 2);
        for (let dy = -half; dy <= half; dy++) {
            for (let dx = -half; dx <= half; dx++) {
                if (brush.shape === 'circle' && half > 0) {
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist > half + 0.5) continue;
                }
                tiles.push({ x: centerX + dx, y: centerY + dy });
            }
        }
        return tiles;
    };

    const paintSandboxBrushAtTile = (tx: number, ty: number, erase: boolean) => {
        if (!sandboxBrush) return;
        const tiles = getBrushTiles(tx, ty, sandboxBrush);
        for (const tile of tiles) {
            if (erase) {
                engine.removeUnitAt(tile.x, tile.y);
            } else {
                engine.spawnUnitRaw(tile.x, tile.y, sandboxBrush.unit, sandboxBrush.team);
            }
        }
    };

    // Bresenham's Line Algorithm for smooth painting between frames
    const paintLine = (x0: number, y0: number, x1: number, y1: number, erase: boolean) => {
        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = (x0 < x1) ? 1 : -1;
        const sy = (y0 < y1) ? 1 : -1;
        let err = dx - dy;

        while (true) {
            paintSandboxBrushAtTile(x0, y0, erase);

            if (x0 === x1 && y0 === y1) break;
            const e2 = 2 * err;
            if (e2 > -dy) {
                err -= dy;
                x0 += sx;
            }
            if (e2 < dx) {
                err += dx;
                y0 += sy;
            }
        }
    };

    const paintSandboxBrush = (clientX: number, clientY: number, erase: boolean) => {
        if (!sandboxBrush) return;
        const t = getTilePos(clientX, clientY);

        // Use interpolation if we have a previous point in the same drag
        if (lastPaintedGridPos.current) {
            paintLine(lastPaintedGridPos.current.x, lastPaintedGridPos.current.y, t.x, t.y, erase);
        } else {
            paintSandboxBrushAtTile(t.x, t.y, erase);
        }

        lastPaintedGridPos.current = t;
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (engine.isAttractMode) return;
        (document.activeElement as HTMLElement)?.blur();
        isDragging.current = false;
        ignoreNextClick.current = false;
        dragStart.current = { x: e.clientX, y: e.clientY };
        lastMousePos.current = { x: e.clientX, y: e.clientY };
        panVelocity.current = { x: 0, y: 0 };
        dragStart.current = { x: e.clientX, y: e.clientY };
        lastMousePos.current = { x: e.clientX, y: e.clientY };
        panVelocity.current = { x: 0, y: 0 };
        lastBoughtTile.current = null;
        lastPaintedGridPos.current = null; // Reset interpolation start point

        // Sandbox paint mode
        if (engine.config.gameMode === 'SANDBOX' && sandboxBrush) {
            sandboxPaintButton.current = e.button;
            if (e.button === 0) {
                swipeMode.current = 'SANDBOX_PAINT';
                paintSandboxBrush(e.clientX, e.clientY, false);
            } else if (e.button === 2) {
                swipeMode.current = 'SANDBOX_ERASE';
                paintSandboxBrush(e.clientX, e.clientY, true);
            } else {
                swipeMode.current = 'PAN';
            }
            return;
        }

        swipeMode.current = shopSelection ? 'PURCHASE' : 'PAN';
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (engine.isAttractMode) return;

        // Track mouse world position for ghost brush
        if (engine.config.gameMode === 'SANDBOX') {
            mouseWorldPos.current = getTilePos(e.clientX, e.clientY);
        }

        if (e.buttons > 0 && lastMousePos.current) {
            const dx = e.clientX - lastMousePos.current.x;
            const dy = e.clientY - lastMousePos.current.y;
            if (!isDragging.current) {
                const dist = Math.hypot(e.clientX - dragStart.current.x, e.clientY - dragStart.current.y);
                if (dist > 5) {
                    isDragging.current = true;
                    setSelectionBox(null);
                }
            }
            if (isDragging.current) {
                if ((swipeMode.current === 'SANDBOX_PAINT' || swipeMode.current === 'SANDBOX_ERASE') && sandboxBrush) {
                    const t = getTilePos(e.clientX, e.clientY);

                    // We check if the grid position changed to avoid unnecessary calls in the same tile, 
                    // but paintSandboxBrush handles the interpolation if we moved fast.
                    const tileKey = `${t.x},${t.y}`;
                    if (tileKey !== lastBoughtTile.current) {
                        lastBoughtTile.current = tileKey;
                        paintSandboxBrush(e.clientX, e.clientY, swipeMode.current === 'SANDBOX_ERASE');
                    }
                } else if (swipeMode.current === 'PURCHASE' && shopSelection) {
                    const t = getTilePos(e.clientX, e.clientY);
                    const tileKey = `${t.x},${t.y}`;
                    if (tileKey !== lastBoughtTile.current) {
                        const isValid = validSpawnTiles.current.some(vt => vt.x === t.x && vt.y === t.y);
                        if (isValid) {
                            const id = engine.buyUnit(engine.humanId, shopSelection, t.x, t.y);
                            if (id) {
                                lastBoughtTile.current = tileKey;
                                // REFRESH VALID SPAWNS IMMEDIATELY FOR CHAIN BUILDING
                                validSpawnTiles.current = engine.getValidSpawnTiles(engine.humanId);
                                if (onUnitPlaced) onUnitPlaced();
                                playSound('select');

                                // Auto-close shop if out of credits
                                const player = engine.players.get(engine.humanId);
                                if (player && player.credits < 2) {
                                    if (onCloseShop) onCloseShop();
                                }
                            }
                        }
                    }
                } else if (swipeMode.current === 'PAN') {
                    applyPan(dx, dy);
                }
            }
            lastMousePos.current = { x: e.clientX, y: e.clientY };
        }
    };

    const handleMouseUp = (e: React.MouseEvent) => {
        if (engine.isAttractMode) return;
        if (isDragging.current) {
            ignoreNextClick.current = true;
        } else {
            if (e.button !== 0) {
                handleUnifiedClick(e.clientX, e.clientY, e.button, e);
            }
        }
        isDragging.current = false;
        lastMousePos.current = null;
        lastBoughtTile.current = null;
        swipeMode.current = 'NONE';
    };

    const handleClick = (e: React.MouseEvent) => {
        if (engine.isAttractMode) return;
        if (ignoreNextClick.current) {
            ignoreNextClick.current = false;
            return;
        }
        if (e.button === 0) {
            handleUnifiedClick(e.clientX, e.clientY, 0, e);
        }
    };

    const handleWheel = (e: React.WheelEvent) => {
        if (engine.isAttractMode) return;

        // Use geometric scaling (multiplier) instead of linear addition
        // This ensures the zoom change feels consistent at all levels
        const zoomStep = 1.2; // 20% change per scroll tick
        const direction = -Math.sign(e.deltaY);
        const multiplier = direction > 0 ? zoomStep : 1 / zoomStep;

        const newZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoomRef.current * multiplier));

        if (newZoom !== zoomRef.current) {
            zoomRef.current = newZoom;

            // Throttle click sound to avoid audio lag during rapid scrolling
            const now = Date.now();
            if (now - lastTickSoundTime.current > 50) {
                playSound('tick');
                lastTickSoundTime.current = now;
            }
        }
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (engine.isAttractMode) return;
    };

    const getPinchDistance = (e: React.TouchEvent) => {
        if (e.touches.length < 2) return 0;
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
    };

    const getPinchCenter = (e: React.TouchEvent) => {
        if (e.touches.length < 2) return { x: 0, y: 0 };
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        return {
            x: (t1.clientX + t2.clientX) / 2,
            y: (t1.clientY + t2.clientY) / 2
        };
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        if (engine.isAttractMode) return;
        if (e.touches.length === 2) {
            isPinching.current = true;
            isCameraLocked.current = false;
            panTarget.current = null;
            lastPinchDistance.current = getPinchDistance(e);
            lastPinchCenter.current = getPinchCenter(e);
            panVelocity.current = { x: 0, y: 0 };
            touchStartClientPos.current = null;
            lastTouchPos.current = null;
            setSelectionBox(null);
            return;
        }
        if (e.touches.length === 1) {
            const t = e.touches[0];
            touchStartClientPos.current = { x: t.clientX, y: t.clientY };
            lastTouchPos.current = { x: t.clientX, y: t.clientY };
            panVelocity.current = { x: 0, y: 0 };
            lastBoughtTile.current = null;
            swipeMode.current = shopSelection ? 'PURCHASE' : 'PAN';
            setSelectionBox(null);
            isPanning.current = true;
            isDragging.current = false;
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (engine.isAttractMode) return;
        if (e.touches.length === 2 && isPinching.current) {
            const dist = getPinchDistance(e);
            if (lastPinchDistance.current > 0) {
                const scaleFactor = dist / lastPinchDistance.current;
                const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoomRef.current * scaleFactor));
                zoomRef.current = newZoom;
            }
            lastPinchDistance.current = dist;
            const center = getPinchCenter(e);
            if (lastPinchCenter.current) {
                const dx = center.x - lastPinchCenter.current.x;
                const dy = center.y - lastPinchCenter.current.y;
                applyPan(dx, dy);
            }
            lastPinchCenter.current = center;
            return;
        }
        if (e.touches.length === 1 && lastTouchPos.current && !isPinching.current) {
            const t = e.touches[0];
            const dx = t.clientX - lastTouchPos.current.x;
            const dy = t.clientY - lastTouchPos.current.y;
            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                isDragging.current = true;
            }
            if (isDragging.current && swipeMode.current === 'PURCHASE' && shopSelection) {
                const tPos = getTilePos(t.clientX, t.clientY);
                const tileKey = `${tPos.x},${tPos.y}`;
                if (tileKey !== lastBoughtTile.current) {
                    const isValid = validSpawnTiles.current.some(vt => vt.x === tPos.x && vt.y === tPos.y);
                    if (isValid) {
                        const id = engine.buyUnit(engine.humanId, shopSelection, tPos.x, tPos.y);
                        if (id) {
                            lastBoughtTile.current = tileKey;
                            validSpawnTiles.current = engine.getValidSpawnTiles(engine.humanId);
                            if (onUnitPlaced) onUnitPlaced();
                            playSound('select');
                            const player = engine.players.get(engine.humanId);
                            if (player && player.credits < 2) {
                                if (onCloseShop) onCloseShop();
                            }
                        }
                    }
                }
            } else if (swipeMode.current === 'PAN') {
                applyPan(dx, dy);
            }
            lastTouchPos.current = { x: t.clientX, y: t.clientY };
        }
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (engine.isAttractMode) return;
        if (e.touches.length === 0) {
            isPanning.current = false;
        }
        if (isPinching.current && e.touches.length < 2) {
            isPinching.current = false;
            lastPinchDistance.current = 0;
            lastPinchCenter.current = null;
            if (e.touches.length === 1) {
                const t = e.touches[0];
                lastTouchPos.current = { x: t.clientX, y: t.clientY };
                isPanning.current = true;
            }
            if (Date.now() - lastInputTime.current > 50) {
                panVelocity.current = { x: 0, y: 0 };
            }
            return;
        }
        if (!isDragging.current && touchStartClientPos.current && !isPinching.current && e.changedTouches.length > 0) {
            const t = e.changedTouches[0];
            const dist = Math.hypot(t.clientX - touchStartClientPos.current.x, t.clientY - touchStartClientPos.current.y);
            if (Date.now() - lastInputTime.current > 50) {
                panVelocity.current = { x: 0, y: 0 };
            }
            if (dist < 10) {
                handleUnifiedClick(t.clientX, t.clientY, 0, e);
            }
            touchStartClientPos.current = null;
            lastTouchPos.current = null;
            lastBoughtTile.current = null;
            swipeMode.current = 'NONE';
        }
        isDragging.current = false;
        lastBoughtTile.current = null;
        swipeMode.current = 'NONE';
    };

    // Main Render Loop
    const render = () => {
        // ... (render content remains unchanged)
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Increment frame count
        frameCount.current++;

        const nowReal = Date.now();

        // 1. Update Camera Physics (Integrated in render loop for max performance)
        const camera = cameraRef.current;
        if (engine.isAttractMode) {
            const t = nowReal * 0.00015;
            cameraRef.current = {
                x: Math.sin(t) * 600,
                y: Math.cos(t * 0.8) * 350
            };
        } else {
            let keyDx = 0;
            let keyDy = 0;
            const speed = 20 / zoomRef.current;
            if (keysPressed.current.has('w') || keysPressed.current.has('arrowup')) keyDy -= speed;
            if (keysPressed.current.has('s') || keysPressed.current.has('arrowdown')) keyDy += speed;
            if (keysPressed.current.has('a') || keysPressed.current.has('arrowleft')) keyDx -= speed;
            if (keysPressed.current.has('d') || keysPressed.current.has('arrowright')) keyDx += speed;

            if (keyDx !== 0 || keyDy !== 0) {
                isCameraLocked.current = false;
                panTarget.current = null;
                panVelocity.current = { x: 0, y: 0 };
                cameraRef.current = { x: camera.x + keyDx, y: camera.y + keyDy };
            } else if (isCameraLocked.current) {
                const human = engine.players.get(engine.humanId);
                if (human) {
                    cameraRef.current = {
                        x: camera.x + (human.centerX * TILE_SIZE - camera.x) * 0.1,
                        y: camera.y + (human.centerY * TILE_SIZE - camera.y) * 0.1
                    };
                }
                panTarget.current = null;
            } else if (panTarget.current) {
                const tx = panTarget.current.x;
                const ty = panTarget.current.y;
                if (Math.abs(tx - camera.x) < 5 && Math.abs(ty - camera.y) < 5) {
                    panTarget.current = null;
                    cameraRef.current = { x: tx, y: ty };
                } else {
                    cameraRef.current = {
                        x: camera.x + (tx - camera.x) * 0.1,
                        y: camera.y + (ty - camera.y) * 0.1
                    };
                }
            } else if (!isPanning.current && !isPinching.current && !isDragging.current && keysPressed.current.size === 0) {
                const vx = panVelocity.current.x;
                const vy = panVelocity.current.y;
                if (Math.abs(vx) > 0.05 || Math.abs(vy) > 0.05) {
                    cameraRef.current = { x: camera.x + vx, y: camera.y + vy };
                    panVelocity.current = { x: vx * 0.80, y: vy * 0.80 };
                }
            }
        }

        // Update Engine
        engine.tick();

        // Consume Events (Particles)
        const events = engine.consumeEvents();
        events.forEach(ev => {
            if (ev.type === GameEventType.DEATH) {
                const isHumanInvolved = ev.metadata?.attackerId === engine.humanId || ev.metadata?.victimId === engine.humanId;
                if (isHumanInvolved) {
                    playSound('capture');
                }
                // Spawn Shatter Particles
                const color = ev.metadata?.color || '#fff';
                for (let i = 0; i < 10; i++) {
                    particles.current.push({
                        x: ev.x * TILE_SIZE + TILE_SIZE / 2,
                        y: ev.y * TILE_SIZE + TILE_SIZE / 2,
                        vx: (Math.random() - 0.5) * 6,
                        vy: (Math.random() - 0.5) * 6,
                        life: 1.0,
                        maxLife: 1.0,
                        color: color,
                        size: Math.random() * 4 + 2
                    });
                }
            }

            if (ev.type === GameEventType.CONVERSION) {
                // Spawn Conversion/Spawn Particles
                const color = ev.metadata?.color || '#fff';
                // Find unit logic
                const unitId = engine.positionMap.get(`${ev.x},${ev.y}`);
                if (unitId) {
                    const entity = renderEntities.current.get(unitId);
                    if (entity) {
                        entity.flash = 1.0;
                        entity.flashColor = color; // Store specific color
                    }
                }

                for (let i = 0; i < 8; i++) {
                    particles.current.push({
                        x: ev.x * TILE_SIZE + TILE_SIZE / 2,
                        y: ev.y * TILE_SIZE + TILE_SIZE / 2,
                        vx: (Math.random() - 0.5) * 4,
                        vy: -Math.random() * 4, // Upward flow
                        life: 1.5,
                        maxLife: 1.5,
                        color: color,
                        size: Math.random() * 3 + 2
                    });
                }
                const isHumanInvolved = ev.metadata?.attackerId === engine.humanId || ev.metadata?.victimId === engine.humanId;
                if (isHumanInvolved) {
                    playSound('spawn');
                }
            }
            if (ev.type === GameEventType.SPAWN) {
                const color = ev.metadata?.color || '#fff';
                const unitId = engine.positionMap.get(`${ev.x},${ev.y}`);
                const tx = ev.x * TILE_SIZE + TILE_SIZE / 2;
                const ty = ev.y * TILE_SIZE + TILE_SIZE / 2;

                // 1. Flash the unit
                if (unitId) {
                    const entity = renderEntities.current.get(unitId);
                    if (entity) {
                        entity.flash = 1.0;
                        entity.flashColor = '#fff'; // Sharp white flash
                    }
                }

                // 2. Dimensional Implosion (Gathering energy)
                for (let i = 0; i < 20; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const r = 20 + Math.random() * 20;
                    particles.current.push({
                        x: tx + Math.cos(angle) * r,
                        y: ty + Math.sin(angle) * r,
                        vx: -Math.cos(angle) * 3, // Move inward
                        vy: -Math.sin(angle) * 3,
                        life: 0.5,
                        maxLife: 0.5,
                        color: color,
                        size: Math.random() * 2 + 1,
                        text: 'IMPLODE'
                    });
                }

                // 3. Horizontal Glitch Static
                for (let i = 0; i < 8; i++) {
                    particles.current.push({
                        x: tx,
                        y: ty + (Math.random() - 0.5) * TILE_SIZE,
                        vx: (Math.random() - 0.5) * 5, // Jitter
                        vy: 0,
                        life: 0.3,
                        maxLife: 0.3,
                        color: color,
                        size: Math.random() * 20 + 20, // Width
                        text: 'GLITCH'
                    });
                }

                // 4. Sharp Static Pixels (After-effect)
                for (let i = 0; i < 10; i++) {
                    particles.current.push({
                        x: (ev.x * TILE_SIZE) + (Math.random() * TILE_SIZE),
                        y: (ev.y * TILE_SIZE) + (Math.random() * TILE_SIZE),
                        vx: 0,
                        vy: (Math.random() - 0.5) * 1,
                        life: 0.6,
                        maxLife: 0.6,
                        color: '#fff',
                        size: 2,
                        text: 'STATIC'
                    });
                }

                playSound('spawn');
            }
            if (ev.type === GameEventType.COIN_PICKUP) {
                // Only show for Human Player
                if (ev.metadata?.playerId === engine.humanId) {
                    playSound('coin');

                    // Floating +1 Text
                    const amount = ev.metadata?.amount || 1;
                    const isKill = ev.metadata?.isKillReward;
                    const text = isKill ? `+${amount} 🟡` : `+${amount}`;

                    particles.current.push({
                        x: ev.x * TILE_SIZE + TILE_SIZE / 2,
                        y: ev.y * TILE_SIZE, // Start slightly above
                        vx: 0,
                        vy: -1, // Float up
                        life: 1.5,
                        maxLife: 1.5,
                        color: COLORS.GOLD,
                        size: 14,
                        text: text
                    });
                }
            }
        });

        // THROTTLED UI UPDATES (Every 10 frames = ~160ms)
        // This is the single biggest performance fix
        if (frameCount.current % 10 === 0) {
            // Check Game Over State (New)
            const gameOverInfo = engine.checkGameOver();

            // Update React Stats
            const human = engine.players.get(engine.humanId);
            setStats({
                playersRemaining: engine.playersRemaining,
                fps: 60,
                leaderboard: engine.getLeaderboard(),
                credits: human ? human.credits : 0,
                gameOver: gameOverInfo,
                peaceTimer: engine.peaceTimer, // Expose peace timer
                wave: engine.wave, // Expose Wave
                nextWaveTime: engine.waveTimer // Expose Wave Timer
            });
        }

        // Theme Colors
        const tileA = isLightMode ? COLORS.LIGHT_BACKGROUND : COLORS.BACKGROUND;
        const tileB = isLightMode ? COLORS.LIGHT_GRID : COLORS.GRID;

        // Clear with Background (Tile A)
        ctx.fillStyle = tileA;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const z = zoomRef.current;

        // Viewport Calculation
        const halfW = (canvas.width / 2) / z;
        const halfH = (canvas.height / 2) / z;
        const startCol = Math.floor((camera.x - halfW) / TILE_SIZE) - 1;
        const endCol = Math.ceil((camera.x + halfW) / TILE_SIZE) + 1;
        const startRow = Math.floor((camera.y - halfH) / TILE_SIZE) - 1;
        const endRow = Math.ceil((camera.y + halfH) / TILE_SIZE) + 1;

        ctx.save();

        // Apply Zoom & Camera Transform
        ctx.translate(canvas.width / 2, canvas.height / 2);

        ctx.scale(z, z);
        ctx.translate(-camera.x, -camera.y);

        // Draw Checkerboard (Tile B over Tile A)
        ctx.fillStyle = tileB;
        for (let x = startCol; x <= endCol; x++) {
            for (let y = startRow; y <= endRow; y++) {
                if (Math.abs(x + y) % 2 === 1) {
                    ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                }
            }
        }

        // Draw Terrain Layer (Rocks, Trees, Sand, etc.)
        if (engine.terrainMap && engine.terrainMap.size > 0) {
            const terrainFontSize = Math.round(TILE_SIZE * 0.7);
            ctx.font = `${terrainFontSize}px serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            for (let x = startCol; x <= endCol; x++) {
                for (let y = startRow; y <= endRow; y++) {
                    const tile = engine.terrainMap.get(`${x},${y}`);
                    if (!tile) continue;

                    const px = x * TILE_SIZE;
                    const py = y * TILE_SIZE;

                    // Draw background tint
                    if (tile.color) {
                        ctx.fillStyle = isLightMode
                            ? tile.color + '40'  // 25% opacity in light mode
                            : tile.color + '80';  // 50% opacity in dark mode
                        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                    }

                    // Draw icon (emoji) for walls and forests
                    if (tile.icon) {
                        ctx.fillStyle = '#ffffff';
                        ctx.fillText(tile.icon, px + TILE_SIZE / 2, py + TILE_SIZE / 2 + 2);
                    }
                }
            }
        }

        // ... (Draw Highlights, Coins, Diplomacy Lines - NO CHANGE)
        const uniqueHighlights = new Map<string, string>();

        const now = engine.currentTime;

        if (selectedUnitIds.current.size > 0 && !engine.isAttractMode) {
            selectedUnitIds.current.forEach(unitId => {
                const unit = engine.units.get(unitId);
                if (!unit || unit.isDead) return;

                // Get moves regardless of cooldown for highlighting
                const moves = engine.getUnitPossibleMoves(unitId, false);

                const cooldown = engine.getUnitCooldown(unit.type);
                const onCooldown = (now - unit.lastMoveTime) < cooldown;
                const color = onCooldown
                    ? COLORS.HIGHLIGHT_COOLDOWN
                    : COLORS.HIGHLIGHT_READY;

                for (const move of moves) {
                    const key = `${move.x},${move.y}`;
                    const existing = uniqueHighlights.get(key);
                    // RED (cooldown) should only be set if not already highlight ready (green)
                    if (color === COLORS.HIGHLIGHT_READY) {
                        uniqueHighlights.set(key, color);
                    } else if (!existing) {
                        uniqueHighlights.set(key, color);
                    }
                }
            });
        }

        const drawTileHighlight = (tx: number, ty: number, color: string) => {
            if (tx < startCol || tx > endCol || ty < startRow || ty > endRow) return;
            const x = tx * TILE_SIZE;
            const y = ty * TILE_SIZE;
            ctx.fillStyle = isLightMode ? '#ffffff' : '#000000';
            ctx.fillRect(x, y, TILE_SIZE + 1, TILE_SIZE + 1);
            ctx.save();
            ctx.globalAlpha = isLightMode ? 0.4 : 0.6;
            ctx.fillStyle = color;
            ctx.fillRect(x, y, TILE_SIZE + 1, TILE_SIZE + 1);
            ctx.restore();

            // Selective Border Drawing: Don't draw border touching selected unit (Neon Style Requirement)
            const selId = selectedUnitIds.current.size === 1 ? Array.from(selectedUnitIds.current)[0] : null;
            const selUnit = selId ? engine.units.get(selId) : null;
            const sx = selUnit ? selUnit.x : -999;
            const sy = selUnit ? selUnit.y : -999;

            ctx.beginPath();

            // Top Border (Skip if selected unit is above)
            if (!(sx === tx && sy === ty - 1)) {
                ctx.moveTo(x, y);
                ctx.lineTo(x + TILE_SIZE, y);
            } else {
                ctx.moveTo(x + TILE_SIZE, y); // Skip drawing but move pen
            }

            // Right Border (Skip if selected unit is to the right)
            if (!(sx === tx + 1 && sy === ty)) {
                ctx.moveTo(x + TILE_SIZE, y);
                ctx.lineTo(x + TILE_SIZE, y + TILE_SIZE);
            } else {
                ctx.moveTo(x + TILE_SIZE, y + TILE_SIZE);
            }

            // Bottom Border (Skip if selected unit is below)
            if (!(sx === tx && sy === ty + 1)) {
                ctx.moveTo(x + TILE_SIZE, y + TILE_SIZE);
                ctx.lineTo(x, y + TILE_SIZE);
            } else {
                ctx.moveTo(x, y + TILE_SIZE);
            }

            // Left Border (Skip if selected unit is to the left)
            if (!(sx === tx - 1 && sy === ty)) {
                ctx.moveTo(x, y + TILE_SIZE);
                ctx.lineTo(x, y);
            }

            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.stroke();
        };

        for (const [key, color] of uniqueHighlights) {
            const [xStr, yStr] = key.split(',');
            drawTileHighlight(parseInt(xStr), parseInt(yStr), color);
        }

        if (shopSelection && validSpawnTiles.current.length > 0) {
            for (const tile of validSpawnTiles.current) {
                drawTileHighlight(tile.x, tile.y, COLORS.VALID_SPAWN);
            }
        }

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (const coin of engine.coins.values()) {
            if (coin.x < startCol || coin.x > endCol || coin.y < startRow || coin.y > endRow) continue;
            const cx = coin.x * TILE_SIZE + TILE_SIZE / 2;
            const cy = coin.y * TILE_SIZE + TILE_SIZE / 2;
            const spinPhase = (now / 300);
            const spin = Math.abs(Math.sin(spinPhase));
            ctx.fillStyle = COLORS.GOLD;
            ctx.beginPath();
            ctx.ellipse(cx, cy, (TILE_SIZE / 2.5) * spin, TILE_SIZE / 2.5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#d97706';
            ctx.lineWidth = 1;
            ctx.stroke();
            if (spin > 0.5) {
                ctx.fillStyle = '#78350f';
                ctx.font = 'bold 11px sans-serif';
                ctx.fillText(coin.value.toString(), cx, cy);
            }
        }

        if (engine.config.gameMode === 'DIPLOMACY') {
            const drawnPairs = new Set<string>();
            ctx.save();
            ctx.lineWidth = 2;
            const pulse = (Math.sin(now / 500) + 1) / 2 * 0.4 + 0.4;
            engine.players.forEach(p1 => {
                if (p1.isEliminated) return;
                const k1Id = p1.units.find(u => engine.units.get(u)?.type === UnitType.KING);
                if (!k1Id) return;
                const k1Vis = renderEntities.current.get(k1Id);
                if (!k1Vis) return;
                if (p1.allies.length > 0) {
                    ctx.strokeStyle = '#00ffff';
                    ctx.globalAlpha = 0.6 * pulse;
                    p1.allies.forEach(p2Id => {
                        const pairId = p1.id < p2Id ? `ally-${p1.id}-${p2Id}` : `ally-${p2Id}-${p1.id}`;
                        if (drawnPairs.has(pairId)) return;
                        drawnPairs.add(pairId);
                        const p2 = engine.players.get(p2Id);
                        if (!p2 || p2.isEliminated) return;
                        const k2Id = p2.units.find(u => engine.units.get(u)?.type === UnitType.KING);
                        if (!k2Id) return;
                        const k2Vis = renderEntities.current.get(k2Id);
                        if (!k2Vis) return;
                        const x1 = k1Vis.x + TILE_SIZE / 2;
                        const y1 = k1Vis.y + TILE_SIZE / 2;
                        const x2 = k2Vis.x + TILE_SIZE / 2;
                        const y2 = k2Vis.y + TILE_SIZE / 2;
                        ctx.beginPath();
                        ctx.moveTo(x1, y1);
                        ctx.lineTo(x2, y2);
                        ctx.stroke();
                    });
                }
                if (p1.enemies.length > 0) {
                    p1.enemies.forEach(p2Id => {
                        const pairId = p1.id < p2Id ? `war-${p1.id}-${p2Id}` : `war-${p2Id}-${p1.id}`;
                        if (drawnPairs.has(pairId)) return;
                        drawnPairs.add(pairId);
                        const p2 = engine.players.get(p2Id);
                        if (!p2 || p2.isEliminated) return;
                        const k2Id = p2.units.find(u => engine.units.get(u)?.type === UnitType.KING);
                        if (!k2Id) return;
                        const k2Vis = renderEntities.current.get(k2Id);
                        if (!k2Vis) return;
                        const dist = Math.hypot(k1Vis.x - k2Vis.x, k1Vis.y - k2Vis.y) / TILE_SIZE;
                        let alpha = 0.2;
                        if (dist < 30) alpha = 0.8;
                        ctx.strokeStyle = '#ef4444';
                        ctx.globalAlpha = alpha;
                        const x1 = k1Vis.x + TILE_SIZE / 2;
                        const y1 = k1Vis.y + TILE_SIZE / 2;
                        const x2 = k2Vis.x + TILE_SIZE / 2;
                        const y2 = k2Vis.y + TILE_SIZE / 2;
                        ctx.beginPath();
                        ctx.moveTo(x1, y1);
                        ctx.lineTo(x2, y2);
                        ctx.stroke();
                    });
                }
            });
            ctx.restore();
        }

        if (selectionBox) {
            ctx.fillStyle = COLORS.SELECTION;
            ctx.strokeStyle = COLORS.SELECTION_BORDER;
            const x = Math.min(selectionBox.startX, selectionBox.endX);
            const y = Math.min(selectionBox.startY, selectionBox.endY);
            const w = Math.abs(selectionBox.endX - selectionBox.startX);
            const h = Math.abs(selectionBox.endY - selectionBox.startY);
            ctx.fillRect(x, y, w, h);
            ctx.strokeRect(x, y, w, h);
        }

        ctx.restore();

        // --- Draw Units with Visual Interpolation ---
        const fontScale = TILE_SIZE * 0.8;
        ctx.font = `${fontScale}px "Segoe UI Symbol", "DejaVu Sans", Symbola, Arial, sans-serif`;

        const activeUnitIds = new Set<string>();

        for (const unit of engine.units.values()) {
            if (unit.isDead) continue;
            activeUnitIds.add(unit.id);

            // Culling & Optimization
            if (unit.x < startCol || unit.x > endCol || unit.y < startRow || unit.y > endRow) {
                let visual = renderEntities.current.get(unit.id);
                if (visual) {
                    visual.x = unit.x * TILE_SIZE;
                    visual.y = unit.y * TILE_SIZE;
                } else {
                    renderEntities.current.set(unit.id, {
                        x: unit.x * TILE_SIZE,
                        y: unit.y * TILE_SIZE,
                        bumpX: 0,
                        bumpY: 0,
                        flash: 0
                    });
                }
                continue;
            }

            // Get Render State
            let visual = renderEntities.current.get(unit.id);
            if (!visual) {
                visual = { x: unit.x * TILE_SIZE, y: unit.y * TILE_SIZE, bumpX: 0, bumpY: 0, flash: 0 };
                renderEntities.current.set(unit.id, visual);
            }

            // Lerp Logic (Smooth Movement)
            const targetX = unit.x * TILE_SIZE;
            const targetY = unit.y * TILE_SIZE;

            const diffX = targetX - visual.x;
            const diffY = targetY - visual.y;

            // Snap to target if very close to prevent sub-pixel offset at rest
            if (Math.abs(diffX) < 1.0 && Math.abs(diffY) < 1.0) {
                visual.x = targetX;
                visual.y = targetY;
            } else {
                // Scale Lerp (0.1 base) with timeMultiplier (capped at 0.9 for stability)
                const lerpFactor = Math.min(0.9, 0.1 * engine.timeMultiplier);
                visual.x += diffX * lerpFactor;
                visual.y += diffY * lerpFactor;
            }

            // Calculate precise center in world space using lerped position
            const centerX = visual.x + TILE_SIZE / 2;
            const centerY = visual.y + TILE_SIZE / 2;

            // Project to screen space manually based on camera and zoom
            const screenX = (centerX - camera.x) * z + canvas.width / 2;
            const screenY = (centerY - camera.y) * z + canvas.height / 2;

            // Round to nearest integer to lock to pixel grid
            const integerScreenX = Math.round(screenX);
            const integerScreenY = Math.round(screenY);

            ctx.save(); // Save context before applying screen space transform

            // Reset transform to identity so we can draw in pure Screen Coordinates
            // This prevents "jitter" and ensures text renders clearly
            ctx.setTransform(1, 0, 0, 1, 0, 0);

            // 1. Selection Box (Drawn in Screen Space for consistent thickness)
            const isSelected = selectedUnitIds.current.has(unit.id);
            if (isSelected) {
                const owner = engine.players.get(unit.ownerId);
                ctx.strokeStyle = owner ? owner.color : COLORS.SELECTION_BORDER;
                ctx.lineWidth = Math.max(1, 2 * z); // Scale thickness with zoom (Thinner)
                const size = TILE_SIZE * z;
                // Draw Corner Brackets (Neon Tactical Style)
                const bracketLen = size * 0.25;
                const x = Math.round(integerScreenX - size / 2);
                const y = Math.round(integerScreenY - size / 2);
                const s = Math.round(size);

                ctx.beginPath();
                // Top Left
                ctx.moveTo(x, y + bracketLen);
                ctx.lineTo(x, y);
                ctx.lineTo(x + bracketLen, y);
                // Top Right
                ctx.moveTo(x + s - bracketLen, y);
                ctx.lineTo(x + s, y);
                ctx.lineTo(x + s, y + bracketLen);
                // Bottom Right
                ctx.moveTo(x + s, y + s - bracketLen);
                ctx.lineTo(x + s, y + s);
                ctx.lineTo(x + s - bracketLen, y + s);
                // Bottom Left
                ctx.moveTo(x + bracketLen, y + s);
                ctx.lineTo(x, y + s);
                ctx.lineTo(x, y + s - bracketLen);

                ctx.stroke();
            }

            // 2. Draw Unit Icon
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const fontSize = Math.floor(TILE_SIZE * 0.7 * z);
            ctx.font = `${fontSize}px "Segoe UI Symbol", "DejaVu Sans", Symbola, Arial, sans-serif`;

            const icon = unit.isZombie ? ZOMBIE_ICONS[unit.type] : UNIT_ICONS[unit.type];
            const owner = engine.players.get(unit.ownerId);

            // Zombie Glitch / Color Logic
            if (unit.isZombie) {
                ctx.fillStyle = COLORS.ZOMBIE_GREEN;
                if (Math.random() < 0.1) ctx.fillStyle = '#fff';
            } else {
                ctx.fillStyle = owner ? owner.color : '#888888';
            }

            // Neon Glow (Backlight)
            if (z > 0.2) {
                // Determine glow color
                const glowColor = unit.isZombie ? COLORS.ZOMBIE_GREEN : (owner ? owner.color : '#888888');
                ctx.shadowColor = glowColor;
                ctx.shadowBlur = 10 * z; // Scale blur with zoom
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
            } else {
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
            }

            // Draw at integerScreenX/Y (which are screen coordinates)
            ctx.fillText(icon, integerScreenX, integerScreenY + (glyphOffsets.current[unit.type] || 0) * z);

            // Reset Shadow
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;

            // 3. Cooldown Ring (Drawn in Screen Space)
            const elapsed = now - unit.lastMoveTime;
            const totalCooldown = engine.getUnitCooldown(unit.type);
            if (elapsed < totalCooldown) {
                const ratio = elapsed / totalCooldown;
                const radius = TILE_SIZE * 0.42 * z; // Scale radius by zoom (Slightly smaller)

                ctx.beginPath();
                // Draw around the screen position
                ctx.arc(integerScreenX, integerScreenY, radius, -Math.PI / 2, (-Math.PI / 2) + (Math.PI * 2 * ratio));

                // Color-coded Ring with Glow
                const ringColor = unit.isZombie ? COLORS.ZOMBIE_GREEN : (owner ? owner.color : '#ffffff');
                ctx.strokeStyle = ringColor;
                ctx.lineWidth = Math.max(1, 2.5 * z); // Slightly thinner

                // Add glow to ring
                if (z > 0.2) {
                    ctx.shadowColor = ringColor;
                    ctx.shadowBlur = 5 * z;
                }

                ctx.stroke();

                // Reset shadow after ring
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
            }

            ctx.restore();

            // 4. Draw Flash (Conversion / Alliance Effect) - Also stabilized
            if (visual.flash > 0) {
                ctx.save();
                // Reset transform for screen space drawing
                ctx.setTransform(1, 0, 0, 1, 0, 0);

                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const fontSize = Math.floor(TILE_SIZE * 0.7 * z);
                ctx.font = `${fontSize}px "Segoe UI Symbol", "DejaVu Sans", Symbola, Arial, sans-serif`;

                // Calculate screen position
                const centerX = visual.x + TILE_SIZE / 2;
                const centerY = visual.y + TILE_SIZE / 2;
                const screenX = Math.round((centerX - camera.x) * z + canvas.width / 2);
                const screenY = Math.round((centerY - camera.y) * z + canvas.height / 2);

                ctx.globalAlpha = visual.flash;
                ctx.fillStyle = visual.flashColor || '#ffffff';
                const icon = unit.isZombie ? ZOMBIE_ICONS[unit.type] : UNIT_ICONS[unit.type];
                ctx.fillText(icon, screenX, screenY + (glyphOffsets.current[unit.type] || 0) * z);

                ctx.restore();

                visual.flash = Math.max(0, visual.flash - 0.05 * engine.timeMultiplier);
            }
        }

        // ... (Chat bubble and particle rendering remains the same)
        // --- CHAT BUBBLES RENDER PASS ---
        engine.players.forEach(player => {
            if (!player.chatMessage || player.chatTimer <= 0) return;

            // Find King for accurate positioning
            let wx = player.centerX * TILE_SIZE + TILE_SIZE / 2;
            let wy = player.centerY * TILE_SIZE;

            // Try to find the actual king unit for precision
            const kingId = player.units.find(uid => {
                const u = engine.units.get(uid);
                return u && u.type === UnitType.KING;
            });

            if (kingId) {
                const visual = renderEntities.current.get(kingId);
                if (visual) {
                    wx = visual.x + TILE_SIZE / 2;
                    wy = visual.y; // Top of tile
                } else {
                    const u = engine.units.get(kingId);
                    if (u) {
                        wx = u.x * TILE_SIZE + TILE_SIZE / 2;
                        wy = u.y * TILE_SIZE;
                    }
                }
            }

            // Project to Screen
            const screenX = (wx - camera.x) * z + canvas.width / 2;
            const screenY = (wy - camera.y) * z + canvas.height / 2;

            // Screen Space Culling (Margin of 200px for safety)
            if (screenX < -200 || screenX > canvas.width + 200 || screenY < -200 || screenY > canvas.height + 200) return;

            ctx.save();

            // CRITICAL FIX: Reset transform to Identity so we draw in Screen Space
            ctx.setTransform(1, 0, 0, 1, 0, 0);

            // Animation: Float Up & Fade
            const lifeRatio = player.chatTimer / 3000;
            const floatOffset = (1 - lifeRatio) * 20; // Float up 20px
            const alpha = Math.min(1, lifeRatio * 2); // Fade out at end

            ctx.globalAlpha = alpha;
            ctx.font = 'bold 12px "Inter", sans-serif';
            const textMetrics = ctx.measureText(player.chatMessage);
            const padding = 6;
            const boxWidth = textMetrics.width + (padding * 2);
            const boxHeight = 20;

            // Box Positioning
            const boxX = screenX - boxWidth / 2;
            const boxY = screenY - boxHeight - 10 - floatOffset; // 10px gap

            // Draw Bubble Background
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 5);
            } else {
                ctx.rect(boxX, boxY, boxWidth, boxHeight);
            }
            ctx.fill();

            // Draw Triangle Tail
            ctx.beginPath();
            ctx.moveTo(screenX, boxY + boxHeight);
            ctx.lineTo(screenX - 5, boxY + boxHeight);
            ctx.lineTo(screenX, boxY + boxHeight + 5);
            ctx.lineTo(screenX + 5, boxY + boxHeight);
            ctx.fill();

            // Draw Text
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(player.chatMessage, screenX, boxY + boxHeight / 2);

            ctx.restore();
        });

        // Cleanup RenderEntities (Memory)
        for (const id of renderEntities.current.keys()) {
            if (!activeUnitIds.has(id)) {
                renderEntities.current.delete(id);
            }
        }

        // Mode Overlay (draw mode-specific visuals)
        if (engine.activeMode) {
            engine.activeMode.drawOverlay(ctx, engine);
        }

        // --- Sandbox Ghost Brush ---
        if (engine.config.gameMode === 'SANDBOX' && sandboxBrush && mouseWorldPos.current) {
            const ghost = mouseWorldPos.current;
            const brushTiles = getBrushTiles(ghost.x, ghost.y, sandboxBrush);
            const teamPlayer = engine.players.get(sandboxBrush.team);
            const teamColor = teamPlayer?.color || '#ffffff';
            const icon = UNIT_ICONS[sandboxBrush.unit];
            const fontSize = Math.max(8, TILE_SIZE * 0.7 * z);

            ctx.save();
            ctx.globalAlpha = 0.35;
            ctx.font = `bold ${fontSize}px "Inter", "Segoe UI Emoji", sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            for (const tile of brushTiles) {
                const sx = (tile.x * TILE_SIZE + TILE_SIZE / 2 - camera.x) * z + canvas.width / 2;
                const sy = (tile.y * TILE_SIZE + TILE_SIZE / 2 - camera.y) * z + canvas.height / 2;

                // Ghost tile highlight
                const tx = (tile.x * TILE_SIZE - camera.x) * z + canvas.width / 2;
                const ty = (tile.y * TILE_SIZE - camera.y) * z + canvas.height / 2;
                ctx.fillStyle = teamColor + '22';
                ctx.fillRect(tx, ty, TILE_SIZE * z, TILE_SIZE * z);

                // Ghost unit icon
                ctx.fillStyle = teamColor;
                ctx.fillText(icon, sx, sy);
            }
            ctx.restore();
        }

        // --- Draw Particles (Screen Space) ---
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset for Screen Space

        for (let i = particles.current.length - 1; i >= 0; i--) {
            const p = particles.current[i];

            const isWorldEffect = !p.text || ['GLITCH', 'IMPLODE', 'STATIC'].includes(p.text);
            const speedMult = isWorldEffect ? engine.timeMultiplier : 1;

            p.x += p.vx * speedMult;
            p.y += p.vy * speedMult;
            p.life -= 0.03 * speedMult;

            // Project to Screen
            const screenX = (p.x - camera.x) * z + canvas.width / 2;
            const screenY = (p.y - camera.y) * z + canvas.height / 2;

            // Screen Culling (Margin of 100px)
            if (screenX < -100 || screenX > canvas.width + 100 || screenY < -100 || screenY > canvas.height + 100) {
                // Off screen
            } else if (p.life > 0) {
                ctx.globalAlpha = Math.min(1, p.life);
                ctx.fillStyle = p.color;

                const sx = Math.round(screenX);
                const sy = Math.round(screenY);

                if (p.text === 'GLITCH') {
                    // Draw horizontal glitch bar (Fixed height 2px, Width scales slightly with life)
                    // In screen space, we want it to look digital/glitchy, so no zoom scaling on height
                    ctx.save();
                    ctx.globalAlpha = p.life / p.maxLife;
                    ctx.fillStyle = p.color;
                    const w = Math.max(2, p.size * z); // Ensure visible width
                    const h = Math.max(1, 2 * z);
                    ctx.fillRect(sx - w / 2, sy, w, h);
                    ctx.restore();
                } else if (p.text === 'IMPLODE' || p.text === 'STATIC') {
                    // Sharp pixel/voxel - Scaled with zoom
                    const s = Math.max(1, p.size * z);
                    ctx.fillStyle = p.color;
                    ctx.fillRect(sx - s / 2, sy - s / 2, s, s);
                } else if (p.text) {
                    const fontSize = Math.max(8, 12 * z);
                    ctx.font = `bold ${fontSize}px monospace`;
                    ctx.fillText(p.text, sx, sy);
                } else {
                    // Standard Square Particle
                    const s = Math.max(1, p.size * z);
                    ctx.fillRect(sx - s / 2, sy - s / 2, s, s);
                }
                ctx.globalAlpha = 1.0;
            }

            if (p.life <= 0) {
                particles.current.splice(i, 1);
            }
        }
        ctx.restore();
        requestRef.current = requestAnimationFrame(render);
    };

    useEffect(() => {
        requestRef.current = requestAnimationFrame(render);
        return () => cancelAnimationFrame(requestRef.current!);
    }, [engine, isGameOver, isLightMode, shopSelection]);

    return (
        <canvas
            ref={canvasRef}
            className={`w-full h-full block transition-all duration-1000 ${isGameOver ? 'grayscale' : ''} ${engine.isAttractMode ? 'cursor-default' : 'cursor-crosshair'}`}
            style={{
                touchAction: 'none',
                transitionDuration: isResignation ? '0ms' : '1000ms'
            }}
            width={window.innerWidth}
            height={window.innerHeight}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onClick={handleClick}
            onWheel={handleWheel}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onContextMenu={handleContextMenu}
        />
    );
});

// Memoize to prevent parent state updates (like coin/FPS stats) from re-triggering this intensive component
export const GameCanvas = React.memo(GameCanvasComponent);
