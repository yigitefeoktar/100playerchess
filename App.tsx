// ... (imports match existing file structure)
import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from './services/gameEngine';
import { GameCanvas, GameCanvasRef } from './components/GameCanvas';
import { Minimap } from './components/Minimap';
import { Leaderboard } from './components/Leaderboard';
import { GameOverModal } from './components/GameOverModal';
import { MainMenu } from './components/MainMenu';
import { GameStats, UnitType, Coords, GameOverStats, GameConfig, Player } from './types';
import { SHOP_PRICES, UNIT_ICONS, TILE_SIZE } from './constants';
import { SpectatorGameOverModal } from './components/SpectatorGameOverModal';
import { SandboxToolbar } from './components/SandboxToolbar';
import { SandboxMode } from './logic/SandboxMode';
import { useTranslation } from './i18n';
import { useSound } from './sound';

const App: React.FC = () => {
    const { t } = useTranslation();
    const { playSound } = useSound();
    const engineRef = useRef<GameEngine | null>(null);
    const [stats, setStats] = useState<Partial<GameStats>>({ playersRemaining: 100, leaderboard: [], credits: 0 });
    const [showHelp, setShowHelp] = useState(false);
    const [showLeaderboard, setShowLeaderboard] = useState(true);
    const [showMinimap, setShowMinimap] = useState(true);
    const [showShop, setShowShop] = useState(false);
    const [selectedShopUnit, setSelectedShopUnit] = useState<UnitType | null>(null);
    const [shopBtnPos, setShopBtnPos] = useState<{ x: number, y: number } | null>(null);
    const [showResignConfirm, setShowResignConfirm] = useState(false);
    const [showMainMenuConfirm, setShowMainMenuConfirm] = useState(false);

    // Diplomacy Context Menu State
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, targetId: string, isAlly: boolean } | null>(null);

    // Game Configuration (Persisted)
    const [gameConfig, setGameConfig] = useState<GameConfig>({
        humanColor: '#3b82f6', // Default Blue
        difficulty: 'Medium',
        gameMode: 'STANDARD'
    });

    // Light Mode State
    const [isLightMode, setIsLightMode] = useState(() => {
        return localStorage.getItem('theme') === 'light';
    });

    // Game Session State
    const [gameStarted, setGameStarted] = useState(false);
    const [gameId, setGameId] = useState(0);

    // End Game State
    const [gameOverStats, setGameOverStats] = useState<GameOverStats | null>(null);
    const [spectatorWinner, setSpectatorWinner] = useState<Player | null>(null);
    const [isSpectating, setIsSpectating] = useState(false); // Default to false (menu background is attract mode, not active spectating)
    const [timeMultiplier, setTimeMultiplier] = useState(1);
    const gameOverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Sandbox State
    const [sandboxTeam, setSandboxTeam] = useState('sandbox-blue');
    const [sandboxUnit, setSandboxUnit] = useState<UnitType>(UnitType.PAWN);
    const [sandboxBrushSize, setSandboxBrushSize] = useState(1);
    const [sandboxBrushShape, setSandboxBrushShape] = useState<'square' | 'circle'>('square');
    const [sandboxSimRunning, setSandboxSimRunning] = useState(false);

    // Flash state for buttons
    const [flashingBtn, setFlashingBtn] = useState<string | null>(null);

    // Refs for click-outside detection
    const helpRef = useRef<HTMLDivElement>(null);
    const helpBtnRef = useRef<HTMLButtonElement>(null);

    // Shared ref for high-performance camera syncing (no re-renders)
    const cameraRef = useRef<Coords>({ x: 0, y: 0 });
    // Shared ref for zoom level
    const zoomRef = useRef<number>(1);

    const canvasRef = useRef<GameCanvasRef>(null);

    // Apply Theme Effect
    useEffect(() => {
        if (isLightMode) {
            document.body.classList.add('light-mode');
        } else {
            document.body.classList.remove('light-mode');
        }
        localStorage.setItem('theme', isLightMode ? 'light' : 'dark');
    }, [isLightMode]);

    // Initialize engine with defaults for the background battle
    if (!engineRef.current) {
        engineRef.current = new GameEngine();
        // Start immediately in Attract Mode (Background Battle)
        engineRef.current.initAttractMode();
    }

    const handleDeploy = () => {
        // Re-initialize engine with selected config
        engineRef.current = new GameEngine(gameConfig);
        // Explicitly start Real Game (clears Attract Mode)
        engineRef.current.initGame();

        playSound('spawn');
        setStats({ playersRemaining: 100, leaderboard: [], credits: 0 });
        setGameOverStats(null);
        setSpectatorWinner(null);
        setIsSpectating(false);
        setGameStarted(true);
        setTimeMultiplier(1);
        setGameId(prev => prev + 1);

        // Adjust Zoom for Asymmetrical Map (Wider view)
        zoomRef.current = 0.8;
    };

    const handleRestart = () => {
        // Restart with current config
        if (engineRef.current) {
            engineRef.current = new GameEngine(gameConfig);
            engineRef.current.initGame();
        } else {
            engineRef.current = new GameEngine(gameConfig);
            engineRef.current.initGame();
        }

        setStats({ playersRemaining: 100, leaderboard: [], credits: 0 });
        setGameOverStats(null);
        setSpectatorWinner(null);
        setIsSpectating(false);
        setTimeMultiplier(1);
        if (gameOverTimerRef.current) {
            clearTimeout(gameOverTimerRef.current);
            gameOverTimerRef.current = null;
        }
        playSound('click');
        setGameId(prev => prev + 1);
    };

    const handleMainMenu = () => {
        setGameStarted(false);
        setGameOverStats(null);
        setSpectatorWinner(null);
        setIsSpectating(false);
        setTimeMultiplier(1);
        setStats({ playersRemaining: 100, leaderboard: [], credits: 0 });
        setShowResignConfirm(false);
        setShowMainMenuConfirm(false);

        // Reset Camera Angle and Zoom to default for Attract Mode
        zoomRef.current = 1;
        cameraRef.current = { x: 0, y: 0 };

        if (engineRef.current) {
            engineRef.current.setPaused(false); // Unpause so attract mode runs
            engineRef.current.initAttractMode();
        }

        if (gameOverTimerRef.current) {
            clearTimeout(gameOverTimerRef.current);
            gameOverTimerRef.current = null;
        }

        playSound('click');
        // Increment gameId to force GameCanvas remount, resetting internal view state/animations
        setGameId(prev => prev + 1);
    };

    const handleSpectate = () => {
        if (engineRef.current) {
            engineRef.current.setPaused(false);
        }
        setGameOverStats(null);
        setIsSpectating(true);
    };

    const handlePlayerSelect = (playerId: string) => {
        const player = engineRef.current?.players.get(playerId);
        if (player && canvasRef.current && engineRef.current) {
            // Find the King
            let targetX = player.centerX * TILE_SIZE + (TILE_SIZE / 2);
            let targetY = player.centerY * TILE_SIZE + (TILE_SIZE / 2);

            // Prioritize King's location
            for (const unitId of player.units) {
                const unit = engineRef.current.units.get(unitId);
                if (unit && unit.type === UnitType.KING) {
                    targetX = unit.x * TILE_SIZE + (TILE_SIZE / 2);
                    targetY = unit.y * TILE_SIZE + (TILE_SIZE / 2);
                    break;
                }
            }

            canvasRef.current.setCamera(targetX, targetY);
        }
    };

    // Close context menu on outside click
    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    // Handle Game Over Logic
    useEffect(() => {
        if (stats.gameOver) {
            // If we haven't started the timer and haven't shown modal yet
            if (!gameOverTimerRef.current && !gameOverStats && !isSpectating) {
                setShowShop(false); // Close shop immediately
                setShowResignConfirm(false);
                setShowMainMenuConfirm(false);
                setContextMenu(null); // Close menu

                const isResign = stats.gameOver.isResignation;
                const delay = isResign ? 0 : 1500;

                // Wait before showing the modal
                gameOverTimerRef.current = setTimeout(() => {
                    if (engineRef.current) {
                        engineRef.current.setPaused(true);
                    }
                    setGameOverStats(stats.gameOver || null);
                    if (stats.gameOver?.isWin) {
                        playSound('victory');
                    } else {
                        playSound('defeat');
                    }
                }, delay);
            }
        }
    }, [stats.gameOver, gameOverStats, isSpectating]);

    // Handle Spectator Game Over (Simulation Concluded)
    useEffect(() => {
        if (isSpectating && stats.playersRemaining === 1 && !spectatorWinner && engineRef.current) {
            // Find the last surviving bot
            const players = Array.from(engineRef.current.players.values()) as Player[];
            const winner = players.find(p => !p.isEliminated);
            if (winner) {
                setSpectatorWinner(winner);
                engineRef.current.setPaused(true);
                playSound('victory');
            }
        }
    }, [isSpectating, stats.playersRemaining, spectatorWinner, playSound]);

    // Handle outside clicks to close help
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent | TouchEvent) => {
            if (showHelp &&
                helpRef.current &&
                !helpRef.current.contains(event.target as Node) &&
                (!helpBtnRef.current || !helpBtnRef.current.contains(event.target as Node))) {
                setShowHelp(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [showHelp]);

    // Unified interaction handler for top bar buttons
    const handleInteraction = (e: React.MouseEvent<HTMLButtonElement>, animationId: string | null, action: () => void) => {
        e.currentTarget.blur(); // Remove focus immediately

        // Clear unit selection when interacting with HUD
        if (canvasRef.current) {
            canvasRef.current.clearSelection();
        }

        playSound('click');

        // If shop is open, close it first
        if (showShop) {
            setShowShop(false);
            setSelectedShopUnit(null);

            // If the button clicked IS the shop button, we just want to close the shop (toggle behavior).
            // We return here to prevent re-opening it immediately via the 'action'.
            if (animationId === 'shop') {
                return;
            }
        }

        // Apply animation
        if (animationId) {
            setFlashingBtn(animationId);
            setTimeout(() => setFlashingBtn(null), 200);
        }

        // Execute the button's intended action
        action();
    };

    const selectShopItem = (type: UnitType, e?: React.MouseEvent) => {
        // Trigger animation
        setFlashingBtn(`shop-${type}`);
        setTimeout(() => setFlashingBtn(null), 200);

        // Capture button position for flying animation
        if (e) {
            const rect = e.currentTarget.getBoundingClientRect();
            setShopBtnPos({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
        }

        if (selectedShopUnit === type) {
            setSelectedShopUnit(null);
        } else {
            // Check affordability
            const cost = SHOP_PRICES[type];
            if ((stats.credits || 0) >= cost) {
                setSelectedShopUnit(type);
            }
        }
    };

    const handleUnitPlaced = () => {
        // Keep shop open and unit selected for continuous placement
        // User can close shop via button or deselect by clicking icon again
    };

    const handleDiplomacyAction = (action: 'ALLIANCE' | 'BETRAY') => {
        if (!contextMenu || !engineRef.current) return;
        const { targetId } = contextMenu;
        const humanId = engineRef.current.humanId;

        if (action === 'ALLIANCE') {
            engineRef.current.handleAllianceRequest(targetId, humanId);
        } else {
            engineRef.current.breakAlliance(humanId, targetId);
        }
        setContextMenu(null);
    };

    // Shop Units to display
    const shopUnits = [UnitType.PAWN, UnitType.KNIGHT, UnitType.BISHOP, UnitType.ROOK, UnitType.QUEEN];

    return (
        <div className="relative w-screen h-screen overflow-hidden bg-slate-900 font-sans">

            {/* Main Menu Overlay */}
            {!gameStarted && (
                <MainMenu
                    config={gameConfig}
                    setConfig={setGameConfig}
                    onDeploy={handleDeploy}
                    isLightMode={isLightMode}
                    onToggleTheme={() => setIsLightMode(!isLightMode)}
                />
            )}

            {/* Game HUD (Hidden in Main Menu) */}
            {gameStarted && (
                <>
                    {/* Top Bar (Simplified HUD) - Updated Gradient */}
                    <div className="absolute top-0 left-0 w-full h-14 bg-gradient-to-b from-[rgba(10,15,25,0.95)] to-transparent z-10 flex items-center justify-between px-4 pointer-events-none">

                        {/* Left: Stats */}
                        <div className="flex items-center gap-4 pointer-events-auto">
                            {(() => {
                                const hud = engineRef.current?.activeMode?.getHUDData(engineRef.current);
                                return hud ? (
                                    <div className="flex items-center gap-2">
                                        <span className="text-cyan-400/70 text-sm uppercase font-bold tracking-wider">{hud.label}</span>
                                        <span style={{ color: hud.color }} className="font-mono text-xl font-bold">{hud.value}</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <span className="text-cyan-400/70 text-sm uppercase font-bold tracking-wider">Enemies</span>
                                        <span className="text-red-400 font-mono text-xl font-bold">{stats.playersRemaining}</span>
                                    </div>
                                );
                            })()}

                            {/* Show Credits only if playing */}
                            {!isSpectating && (
                                <>
                                    <div className="h-6 w-px bg-cyan-500/20"></div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-cyan-400/70 text-sm uppercase font-bold tracking-wider">Coins</span>
                                        <span className="text-amber-400 font-mono text-xl font-bold flex items-center gap-1">
                                            <span>$</span>{stats.credits || 0}
                                        </span>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Center: Spectator Label */}
                        {isSpectating && (
                            <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 text-cyan-500/50 font-bold tracking-[0.2em] uppercase text-sm pointer-events-none select-none drop-shadow-md">
                                Spectator Mode
                            </div>
                        )}

                        {/* Right: Actions */}
                        <div className="flex items-center gap-2 pointer-events-auto">

                            {/* Shop Toggle - Hidden in Spectator */}
                            {!isSpectating && (
                                <>
                                    <button
                                        onClick={(e) => handleInteraction(e, 'shop', () => setShowShop(true))}
                                        className={`p-2 rounded transition-all duration-200 
                                ${showShop ? 'text-amber-400 bg-cyan-500/10 border border-cyan-500/50 shadow-[0_0_10px_rgba(0,240,255,0.2)]' : 'text-cyan-400/70 hover:text-cyan-400'} 
                                ${flashingBtn === 'shop' ? 'scale-110' : ''}`}
                                        title="Open Shop"
                                        disabled={!!stats.gameOver && !isSpectating}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></svg>
                                    </button>
                                    <div className="h-6 w-px bg-cyan-500/20 mx-1"></div>
                                </>
                            )}

                            {/* Toggles - Visible in Spectator */}
                            <button
                                onClick={(e) => handleInteraction(e, 'leaderboard', () => setShowLeaderboard(showShop ? true : !showLeaderboard))}
                                className={`p-2 rounded transition-all duration-200 
                        ${showLeaderboard ? 'text-cyan-400 bg-cyan-500/10 border border-cyan-500/50 shadow-[0_0_10px_rgba(0,240,255,0.2)]' : 'text-cyan-400/70 hover:text-cyan-400'} 
                        ${flashingBtn === 'leaderboard' ? 'scale-110' : ''}`}
                                title="Toggle Leaderboard"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>
                            </button>

                            <button
                                onClick={(e) => handleInteraction(e, 'minimap', () => setShowMinimap(showShop ? true : !showMinimap))}
                                className={`p-2 rounded transition-all duration-200 
                        ${showMinimap ? 'text-cyan-400 bg-cyan-500/10 border border-cyan-500/50 shadow-[0_0_10px_rgba(0,240,255,0.2)]' : 'text-cyan-400/70 hover:text-cyan-400'} 
                        ${flashingBtn === 'minimap' ? 'scale-110' : ''}`}
                                title="Toggle Minimap"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="2" /></svg>
                            </button>

                            {/* Tools - Resign or Main Menu */}
                            <div className="h-6 w-px bg-cyan-500/20 mx-2"></div>

                            {!isSpectating ? (
                                <>
                                    <button
                                        ref={helpBtnRef}
                                        onClick={(e) => handleInteraction(e, 'help', () => setShowHelp(showShop ? true : !showHelp))}
                                        className={`p-2 rounded transition-all duration-200 text-cyan-400/70 hover:text-cyan-400
                            ${flashingBtn === 'help' ? 'scale-110' : ''}`}
                                        title="Controls"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>
                                    </button>

                                    {/* Resign Button - Top Right */}
                                    <button
                                        onClick={(e) => handleInteraction(e, 'resign', () => setShowResignConfirm(true))}
                                        className={`p-2 rounded transition-all duration-200 
                                text-red-400/70 hover:text-red-400 hover:bg-red-500/10
                                ${flashingBtn === 'resign' ? 'scale-110' : ''}`}
                                        title="Resign"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                                            <line x1="4" y1="22" x2="4" y2="15" />
                                        </svg>
                                    </button>
                                </>
                            ) : (
                                /* Spectator Speed Control & Main Menu */
                                <div className="flex items-center gap-1">
                                    <button
                                        key={`speed-btn-${timeMultiplier}`}
                                        onClick={() => {
                                            const next = timeMultiplier === 1 ? 5 : timeMultiplier === 5 ? 10 : 1;
                                            setTimeMultiplier(next);
                                            if (engineRef.current) engineRef.current.timeMultiplier = next;
                                            playSound('click');
                                        }}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all animate-speed-pop
                                            ${timeMultiplier > 1
                                                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.3)]'
                                                : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                                            }
                                        `}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={timeMultiplier === 10 ? 'animate-pulse' : ''}>
                                            <polygon points="13 19 22 12 13 5 13 19" /><polygon points="2 19 11 12 2 5 2 19" />
                                        </svg>
                                        <span className="text-[10px] font-black uppercase tracking-widest">{timeMultiplier}x Speed</span>
                                    </button>

                                    <div className="h-4 w-px bg-white/5 mx-1"></div>

                                    <button
                                        onClick={(e) => handleInteraction(e, 'mainmenu', () => setShowMainMenuConfirm(true))}
                                        className={`p-2 rounded transition-all duration-200 
                                            text-red-400/70 hover:text-red-400 hover:bg-red-500/10
                                            ${flashingBtn === 'mainmenu' ? 'scale-110' : ''}`}
                                        title="Main Menu"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                            <polyline points="16 17 21 12 16 7" />
                                            <line x1="21" y1="12" x2="9" y2="12" />
                                        </svg>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Diplomacy Context Menu */}
                    {contextMenu && (
                        <div
                            className="fixed z-50 glass-panel p-2 rounded-lg animate-fade-in flex flex-col gap-1 shadow-2xl"
                            style={{ left: contextMenu.x, top: contextMenu.y }}
                            onClick={(e) => e.stopPropagation()} // Prevent click from closing immediately
                        >
                            {!contextMenu.isAlly ? (
                                <button
                                    onClick={() => handleDiplomacyAction('ALLIANCE')}
                                    className="flex items-center gap-2 px-3 py-2 rounded bg-green-500/10 hover:bg-green-500/20 text-green-400 text-xs font-bold uppercase tracking-wider transition-colors border border-green-500/30 hover:border-green-500/50"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
                                    Signal Alliance
                                </button>
                            ) : (
                                <button
                                    onClick={() => handleDiplomacyAction('BETRAY')}
                                    className="flex items-center gap-2 px-3 py-2 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold uppercase tracking-wider transition-colors border border-red-500/30 hover:border-red-500/50"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                                    Betray
                                </button>
                            )}
                        </div>
                    )}

                    {/* Shop Panel (Bottom Center) - Updated Glass */}
                    <div
                        className={`
                    absolute bottom-4 left-1/2 z-30 flex items-end gap-2 pointer-events-auto
                    transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]
                    ${showShop ? '-translate-x-1/2 translate-y-0' : '-translate-x-1/2 translate-y-[150%]'}
                `}
                    >
                        <div className="glass-panel p-2 rounded-xl shadow-2xl flex gap-2">
                            {shopUnits.map(type => {
                                const cost = SHOP_PRICES[type];
                                const canAfford = (stats.credits || 0) >= cost;
                                const isSelected = selectedShopUnit === type;

                                return (
                                    <button
                                        key={type}
                                        onClick={(e) => selectShopItem(type, e)}
                                        className={`
                                    relative flex flex-col items-center justify-center w-16 h-20 rounded-lg transition-all
                                    ${isSelected ? 'bg-cyan-500/20 border-2 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.3)]' : 'border border-white/5 hover:bg-white/5'}
                                    ${!canAfford ? 'opacity-40 grayscale cursor-not-allowed' : 'cursor-pointer'}
                                    ${flashingBtn === `shop-${type}` ? 'scale-110' : ''}
                                `}
                                    >
                                        <span className="text-3xl mb-1 filter drop-shadow-[0_0_5px_rgba(0,0,0,0.5)]">{UNIT_ICONS[type]}</span>
                                        <span className={`text-xs font-bold font-mono ${canAfford ? 'text-amber-400' : 'text-slate-500'}`}>${cost}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Help Modal - Updated Glass */}
                    {showHelp && (
                        <div ref={helpRef} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 glass-panel p-4 rounded-lg shadow-2xl w-64 text-sm animate-in fade-in zoom-in-95 origin-center">
                            <h3 className="text-cyan-400 font-bold mb-2 uppercase text-xs tracking-wider border-b border-cyan-500/30 pb-1">Field Manual</h3>
                            <ul className="space-y-2 text-slate-300">
                                <li className="flex justify-between"><span>Select Unit</span> <span className="text-cyan-200">Left Click</span></li>
                                <li className="flex justify-between"><span>Box Select</span> <span className="text-cyan-200">Drag Left</span></li>
                                <li className="flex justify-between"><span>Move / Attack</span> <span className="text-cyan-200">Right Click</span></li>
                                <li className="flex justify-between"><span>Pan Camera</span> <span className="text-cyan-200">WASD / Mid</span></li>
                                <li className="flex justify-between"><span>Zoom</span> <span className="text-cyan-200">Wheel / Pinch</span></li>
                                <li className="flex justify-between"><span className="text-cyan-400">Diplomacy</span> <span className="text-cyan-200">Right Click King</span></li>
                            </ul>
                        </div>
                    )}

                    {/* Resign Confirmation Modal */}
                    {showResignConfirm && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
                            <div className="glass-panel p-6 rounded-xl shadow-2xl flex flex-col items-center gap-4 animate-modal-pop w-80">
                                <h3 className="text-xl font-bold text-white uppercase tracking-widest">{t('hud.resign')}?</h3>
                                <p className="text-slate-300 text-sm text-center">{t('confirm.resign')}</p>
                                <div className="flex gap-3 w-full mt-2">
                                    <button
                                        onClick={() => setShowResignConfirm(false)}
                                        className="flex-1 py-2 rounded-lg bg-slate-700/50 hover:bg-slate-600 text-white text-xs font-bold uppercase tracking-wider transition-colors border border-white/10"
                                    >
                                        {t('confirm.no')}
                                    </button>
                                    <button
                                        onClick={() => {
                                            engineRef.current?.resign();
                                            setShowResignConfirm(false);
                                        }}
                                        className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-wider transition-colors shadow-[0_0_15px_rgba(239,68,68,0.4)]"
                                    >
                                        {t('confirm.yes')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Main Menu Confirmation Modal (New) */}
                    {showMainMenuConfirm && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
                            <div className="glass-panel p-6 rounded-xl shadow-2xl flex flex-col items-center gap-4 animate-modal-pop w-80">
                                <h3 className="text-xl font-bold text-white uppercase tracking-widest">Quit to Menu?</h3>
                                <p className="text-slate-300 text-sm text-center">Leave spectator mode and return to main menu?</p>
                                <div className="flex gap-3 w-full mt-2">
                                    <button
                                        onClick={() => setShowMainMenuConfirm(false)}
                                        className="flex-1 py-2 rounded-lg bg-slate-700/50 hover:bg-slate-600 text-white text-xs font-bold uppercase tracking-wider transition-colors border border-white/10"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleMainMenu}
                                        className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-wider transition-colors shadow-[0_0_15px_rgba(239,68,68,0.4)]"
                                    >
                                        Quit
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Game Over Modal */}
                    {gameOverStats && (
                        <GameOverModal
                            stats={gameOverStats}
                            onClose={handleSpectate} // Spectate
                            onRestart={handleRestart}
                            onMainMenu={handleMainMenu}
                        />
                    )}

                    {/* Leaderboard */}
                    <Leaderboard
                        entries={stats.leaderboard || []}
                        visible={showLeaderboard && !showShop && (!stats.gameOver || isSpectating)}
                        onPlayerClick={handlePlayerSelect}
                        onClose={() => setShowLeaderboard(false)}
                        onOpen={() => setShowLeaderboard(true)}
                    />

                    {/* Spectator Game Over Modal */}
                    {spectatorWinner && stats.gameOver && (
                        <SpectatorGameOverModal
                            winner={spectatorWinner}
                            totalTime={stats.gameOver.timeSurvived}
                            onRestart={handleRestart}
                            onMainMenu={handleMainMenu}
                        />
                    )}

                    {/* Minimap */}
                    <Minimap
                        engine={engineRef.current!}
                        onNavigate={(x, y) => canvasRef.current?.setCamera(x, y)}
                        cameraRef={cameraRef}
                        zoomRef={zoomRef}
                        visible={showMinimap && !showShop && (!stats.gameOver || isSpectating)}
                        onClose={() => setShowMinimap(false)}
                        onOpen={() => setShowMinimap(true)}
                    />

                    {/* Sandbox Toolbar */}
                    {gameConfig.gameMode === 'SANDBOX' && (
                        <SandboxToolbar
                            selectedTeam={sandboxTeam}
                            setSelectedTeam={setSandboxTeam}
                            selectedUnit={sandboxUnit}
                            setSelectedUnit={setSandboxUnit}
                            brushSize={sandboxBrushSize}
                            setBrushSize={setSandboxBrushSize}
                            brushShape={sandboxBrushShape}
                            setBrushShape={setSandboxBrushShape}
                            isSimulationRunning={sandboxSimRunning}
                            onToggleSimulation={() => {
                                if (!engineRef.current) return;
                                const mode = engineRef.current.activeMode;
                                if (mode && mode instanceof SandboxMode) {
                                    mode.isSimulationRunning = !mode.isSimulationRunning;
                                    engineRef.current.setPaused(!mode.isSimulationRunning);
                                    setSandboxSimRunning(mode.isSimulationRunning);
                                }
                            }}
                            onClearMap={() => {
                                if (!engineRef.current) return;
                                engineRef.current.clearMap();
                            }}
                        />
                    )}
                </>
            )}

            {/* Background Canvas (Blurred when Menu is open) */}
            <div className={`w-full h-full transition-all duration-700 ${!gameStarted ? 'blur-sm scale-105 opacity-80' : ''}`}>
                <GameCanvas
                    key={gameId}
                    ref={canvasRef}
                    engine={engineRef.current}
                    setStats={setStats}
                    shopSelection={selectedShopUnit}
                    onUnitPlaced={handleUnitPlaced}
                    shopButtonPos={shopBtnPos}
                    cameraRef={cameraRef}
                    zoomRef={zoomRef}
                    isShopOpen={showShop}
                    onCloseShop={() => {
                        setShowShop(false);
                        setSelectedShopUnit(null);
                    }}
                    onOpenShop={() => setShowShop(true)}
                    isGameOver={!!stats.gameOver && !isSpectating}
                    isLightMode={isLightMode}
                    isResignation={stats.gameOver?.isResignation}
                    onRightClickEntity={(x, y, targetId) => {
                        // Diplomacy check logic
                        if (gameConfig.gameMode === 'DIPLOMACY' && !isSpectating && engineRef.current) {
                            const target = engineRef.current.players.get(targetId);
                            const me = engineRef.current.players.get(engineRef.current.humanId);
                            if (target && me && !target.isHuman && !target.isEliminated) {
                                const isAlly = me.allies.includes(targetId);
                                setContextMenu({ x, y, targetId, isAlly });
                            }
                        }
                    }}
                    sandboxBrush={gameConfig.gameMode === 'SANDBOX' ? {
                        team: sandboxTeam,
                        unit: sandboxUnit,
                        size: sandboxBrushSize,
                        shape: sandboxBrushShape,
                    } : undefined}
                />
            </div>
        </div>
    );
};

export default App;