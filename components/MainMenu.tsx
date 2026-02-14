
import React, { useState, useEffect } from 'react';
import { GameConfig } from '../types';
import { useTranslation } from '../i18n';
import { useSound } from '../sound';
import { FACTION_COLORS } from '../constants';

interface MainMenuProps {
    config: GameConfig;
    setConfig: (config: GameConfig) => void;
    onDeploy: () => void;
    isLightMode: boolean;
    onToggleTheme: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({ config, setConfig, onDeploy, isLightMode, onToggleTheme }) => {
    const { t, language, setLanguage } = useTranslation();
    const { isSoundEnabled, toggleSound, playSound } = useSound();
    const [scale, setScale] = useState(1);
    const [isModeSelectorOpen, setIsModeSelectorOpen] = useState(false);

    // Auto-scale logic to fit screen
    useEffect(() => {
        const handleResize = () => {
            const TARGET_WIDTH = 512;
            const TARGET_HEIGHT = 700;

            const availableW = window.innerWidth * 0.95;
            const availableH = window.innerHeight * 0.8;

            const scaleW = availableW / TARGET_WIDTH;
            const scaleH = availableH / TARGET_HEIGHT;

            const newScale = Math.min(scaleW, scaleH);

            setScale(Math.max(0.4, newScale));
        };

        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Game modes with translation keys
    const GAME_MODES = [
        { id: 'STANDARD' as const, icon: '⚔️', titleKey: 'mode.standard', descKey: 'mode.standard.desc' },
        { id: 'ADVENTURE' as const, icon: '🌲', titleKey: 'mode.adventure', descKey: 'mode.adventure.desc' },
        { id: 'BULLET' as const, icon: '👹', titleKey: 'mode.bullet', descKey: 'mode.bullet.desc' },
        { id: 'DIPLOMACY' as const, icon: '🤝', titleKey: 'mode.diplomacy', descKey: 'mode.diplomacy.desc' },
        { id: 'ZOMBIES' as const, icon: '🧟', titleKey: 'mode.zombies', descKey: 'mode.zombies.desc' },
        { id: 'SANDBOX' as const, icon: '🛠️', titleKey: 'mode.sandbox', descKey: 'mode.sandbox.desc' }
    ];

    const currentMode = GAME_MODES.find(m => m.id === config.gameMode) || GAME_MODES[0];

    return (
        <div id="main-menu" className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden pointer-events-none">
            <div
                className="flex flex-col items-center pointer-events-auto transition-transform duration-200 ease-out origin-center"
                style={{ transform: `scale(${scale})` }}
            >
                {/* Glass Card Container */}
                <div className="
                    relative flex flex-col items-center w-[32rem] px-8 py-8 rounded-2xl
                    glass-panel animate-modal-pop overflow-hidden
                ">
                    {/* Header */}
                    <div className="text-center mb-6">
                        <h1
                            className="text-6xl font-extrabold text-white tracking-tighter mb-6 glitch-text uppercase"
                            data-text={t('menu.title')}
                        >
                            {t('menu.title')}
                        </h1>

                        <div className="flex gap-2 justify-center">
                            {/* Sound Toggle - Left */}
                            <button
                                onClick={() => {
                                    toggleSound();
                                    if (!isSoundEnabled) playSound('click');
                                }}
                                className={`
                                    flex items-center justify-center gap-1.5 w-32 py-2 rounded-full transition-all duration-300 border
                                    ${isLightMode
                                        ? 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-white hover:shadow-lg'
                                        : 'bg-black/40 text-cyan-400 border-cyan-500/30 hover:bg-cyan-950/50 hover:shadow-[0_0_15px_rgba(34,211,238,0.2)]'}
                                `}
                                title={isSoundEnabled ? 'Mute' : 'Unmute'}
                            >
                                {isSoundEnabled ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /></svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></svg>
                                )}
                                <span className="text-[10px] font-black uppercase tracking-tight">{isSoundEnabled ? 'SOUND: ON' : 'SOUND: OFF'}</span>
                            </button>

                            <button
                                onClick={() => {
                                    onToggleTheme();
                                    playSound('click');
                                }}
                                className={`
                                    flex items-center justify-center gap-1.5 w-32 py-2 rounded-full transition-all duration-300 border
                                    ${isLightMode
                                        ? 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-white hover:shadow-lg'
                                        : 'bg-black/40 text-cyan-400 border-cyan-500/30 hover:bg-cyan-950/50 hover:shadow-[0_0_15px_rgba(34,211,238,0.2)]'}
                                `}
                                title="Toggle Theme"
                            >
                                {isLightMode ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" /></svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></svg>
                                )}
                                <span className="text-[10px] font-black uppercase tracking-tight">{isLightMode ? 'THEME: LIGHT' : 'THEME: DARK'}</span>
                            </button>

                            <button
                                onClick={() => {
                                    setLanguage(language === 'en' ? 'tr' : 'en');
                                    playSound('click');
                                }}
                                className={`
                                    flex items-center justify-center gap-1.5 w-32 py-2 rounded-full transition-all duration-300 border
                                    ${isLightMode
                                        ? 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-white hover:shadow-lg'
                                        : 'bg-black/40 text-cyan-400 border-cyan-500/30 hover:bg-cyan-950/50 hover:shadow-[0_0_15px_rgba(34,211,238,0.2)]'}
                                `}
                                title="Change Language"
                            >
                                <span className="text-sm">{language === 'en' ? '🇬🇧' : '🇹🇷'}</span>
                                <span className="text-[10px] font-black uppercase tracking-tight">{language === 'en' ? 'LANG: EN' : 'LANG: TR'}</span>
                            </button>
                        </div>
                    </div>

                    {/* Settings Container */}
                    <div className="w-full flex flex-col gap-6 mb-8">

                        {/* Section 1: Faction Color */}
                        <div className="flex flex-col items-center space-y-3">
                            <span className="text-cyan-400/70 text-xs uppercase tracking-widest font-bold">{t('menu.factionColor')}</span>
                            <div className="flex flex-wrap justify-center gap-3">
                                {FACTION_COLORS.map(c => (
                                    <button
                                        key={c.name}
                                        onClick={() => {
                                            setConfig({ ...config, humanColor: c.hex });
                                            playSound('faction_change');
                                        }}
                                        className={`
                                            w-10 h-10 rounded-xl transition-all duration-200 shadow-lg
                                            ${c.tw}
                                            ${config.humanColor === c.hex
                                                ? 'ring-2 ring-white scale-110 shadow-[0_0_15px_rgba(255,255,255,0.5)]'
                                                : 'hover:scale-105 hover:ring-2 hover:ring-white/50'}
                                        `}
                                        title={c.name}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Section 2: Difficulty */}
                        <div className="flex flex-col items-center space-y-3 w-full">
                            <span className="text-cyan-400/70 text-xs uppercase tracking-widest font-bold">{t('menu.difficulty')}</span>
                            <div className="flex bg-black/40 rounded-xl p-1 border border-cyan-500/20 w-full max-w-[300px]">
                                {(['Easy', 'Medium', 'Hard'] as const).map(level => (
                                    <button
                                        key={level}
                                        onClick={() => {
                                            setConfig({ ...config, difficulty: level });
                                            playSound('click');
                                        }}
                                        className={`
                                            flex-1 py-2 text-xs font-bold uppercase rounded-lg transition-all text-center
                                            ${config.difficulty === level
                                                ? 'bg-cyan-500/20 text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.2)]'
                                                : 'text-slate-500 hover:text-cyan-200'}
                                        `}
                                    >
                                        {t(`menu.difficulty.${level.toLowerCase()}`)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Section 3: Game Mode Summary Card */}
                        <div className="flex flex-col items-center space-y-3 w-full">
                            <span className="text-cyan-400/70 text-xs uppercase tracking-widest font-bold">{t('menu.gameMode')}</span>

                            <div className="flex items-center justify-between w-full max-w-[400px] bg-black/20 rounded-xl p-4 border border-cyan-500/20 hover:border-cyan-500/40 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-lg bg-cyan-500/10 flex items-center justify-center text-3xl">
                                        {currentMode.icon}
                                    </div>
                                    <div className="flex flex-col text-left">
                                        <span className="text-lg font-bold text-white uppercase tracking-wide">{t(currentMode.titleKey)}</span>
                                        <span className="text-xs text-cyan-400/60 font-medium">{t(currentMode.descKey)}</span>
                                    </div>
                                </div>

                                <button
                                    onClick={() => {
                                        setIsModeSelectorOpen(true);
                                        playSound('click');
                                    }}
                                    className="px-4 py-2 text-[10px] font-bold uppercase bg-cyan-500/10 text-cyan-400 rounded-lg border border-cyan-500/30 hover:bg-cyan-500/20 hover:text-cyan-300 transition-all hover:shadow-[0_0_10px_rgba(34,211,238,0.15)]"
                                >
                                    {t('menu.gameMode.change')}
                                </button>
                            </div>
                        </div>

                    </div>

                    {/* Deploy Button */}
                    <button
                        onClick={() => {
                            onDeploy();
                            playSound('start_game');
                        }}
                        className="
                            relative w-full py-4 rounded-xl font-black text-white text-xl uppercase tracking-[0.2em]
                            bg-gradient-to-r from-blue-600 to-cyan-500 
                            hover:from-blue-500 hover:to-cyan-400
                            shadow-[0_0_30px_rgba(14,165,233,0.4)]
                            hover:shadow-[0_0_50px_rgba(14,165,233,0.6)]
                            transition-all duration-300 transform hover:-translate-y-1 active:scale-95
                            overflow-hidden group
                        "
                    >
                        <span className="relative z-10 flex items-center justify-center gap-3">
                            {t('menu.start')}
                        </span>

                        {/* Scanline Effect */}
                        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 animate-[shimmer_0.5s_infinite]"></div>
                    </button>

                    {/* MODE SELECTOR MODAL - Redesigned Grid Layout */}
                    {isModeSelectorOpen && (
                        <div className="absolute inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col p-6 animate-fade-in rounded-2xl">
                            {/* Modal Header */}
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold text-white uppercase tracking-widest flex items-center gap-3">
                                    <span className="w-1 h-6 bg-cyan-500 rounded-full shadow-[0_0_10px_#06b6d4]"></span>
                                    {t('menu.gameMode.select')}
                                </h2>
                                <button
                                    onClick={() => setIsModeSelectorOpen(false)}
                                    className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                                </button>
                            </div>

                            {/* Grid of Cards */}
                            <div
                                className="w-full grid gap-4 overflow-y-auto p-2"
                                style={{
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))'
                                }}
                            >
                                {GAME_MODES.map((mode) => {
                                    const isSelected = config.gameMode === mode.id;
                                    return (
                                        <button
                                            key={mode.id}
                                            onClick={() => {
                                                // If ADVENTURE mode is selected, enable FOREST map
                                                // Otherwise set to EMPTY (or undefined)
                                                const newMapType = mode.id === 'ADVENTURE' ? 'FOREST' : 'EMPTY';

                                                setConfig({
                                                    ...config,
                                                    gameMode: mode.id,
                                                    mapType: newMapType
                                                });

                                                setIsModeSelectorOpen(false);
                                                playSound('click');
                                            }}
                                            className={`
                                                flex flex-col items-center p-3 rounded-lg border transition-all duration-200
                                                cursor-pointer text-center relative
                                                ${isSelected
                                                    ? 'border-cyan-400 bg-cyan-500/10 shadow-[0_0_15px_rgba(0,240,255,0.15)] scale-[1.05]'
                                                    : 'border-white/10 bg-black/30 hover:bg-white/5'}
                                            `}
                                        >
                                            <span className={`text-3xl mb-3 filter drop-shadow-md transition-transform duration-300 ${isSelected ? 'scale-110' : 'opacity-80'}`}>
                                                {mode.icon}
                                            </span>
                                            <span className={`text-sm font-bold uppercase tracking-wider mb-2 ${isSelected ? 'text-cyan-400' : 'text-white'}`}>
                                                {t(mode.titleKey)}
                                            </span>
                                            <span className="text-[10px] text-slate-400 leading-tight">
                                                {t(mode.descKey)}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};
