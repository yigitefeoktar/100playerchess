
import React from 'react';
import { GameOverStats } from '../types';
import { UNIT_ICONS } from '../constants';
import { useTranslation } from '../i18n';
import { useSound } from '../sound';

interface GameOverModalProps {
    stats: GameOverStats;
    onClose: () => void;
    onRestart: () => void;
    onMainMenu: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({ stats, onClose, onRestart, onMainMenu }) => {
    const { t } = useTranslation();
    const { playSound } = useSound();

    // Dynamic Colors based on state
    const themeColor = stats.isWin ? 'cyan' : 'red';

    // Gradient Text for Title
    const titleGradient = stats.isWin
        ? 'from-cyan-300 via-cyan-100 to-blue-400'
        : 'from-red-500 via-red-300 to-orange-500';

    // Glow for container
    const glowShadow = stats.isWin
        ? 'shadow-[0_0_50px_rgba(34,211,238,0.25)]' // Cyan glow
        : 'shadow-[0_0_50px_rgba(239,68,68,0.25)]'; // Red glow

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    // --- ANIMATION HOOK ---
    const useAnimatedValue = (target: number, duration: number = 1500) => {
        const [value, setValue] = React.useState(0);

        React.useEffect(() => {
            let start = 0;
            const startTime = performance.now();

            const animate = (currentTime: number) => {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);

                // Ease Out Quart
                const ease = 1 - Math.pow(1 - progress, 4);

                const current = start + (target - start) * ease;
                setValue(current);

                if (progress < 1) {
                    requestAnimationFrame(animate);
                }
            };

            requestAnimationFrame(animate);
        }, [target, duration]);

        return value;
    };

    const animatedKings = useAnimatedValue(stats.kingsKilled);
    const animatedCoins = useAnimatedValue(stats.coins);
    const animatedTime = useAnimatedValue(stats.timeSurvived);
    const animatedScore = useAnimatedValue(stats.peakMaterial);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 animate-fade-in">
            <div
                className={`
                    relative w-[32rem] glass-panel rounded-2xl p-8 
                    ${glowShadow}
                    flex flex-col items-center text-center
                    animate-modal-pop
                    overflow-hidden
                `}
            >
                {/* Decorative top sheen */}
                <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>

                {/* Header */}
                <div className="space-y-2 mb-8">
                    <h1 className={`text-5xl font-extrabold uppercase tracking-widest bg-clip-text text-transparent bg-gradient-to-b ${titleGradient} drop-shadow-sm`}>
                        {stats.isWin ? t('gameover.victory') : t('gameover.eliminated')}
                    </h1>
                    <p className="text-cyan-400/80 text-lg font-light tracking-wide">
                        Final Rank <span className="text-white font-semibold">#{stats.rank}</span> / 100
                    </p>
                </div>

                {/* Killer Info (Only on Defeat) - Clean Look with Divider */}
                {!stats.isWin && stats.killerName && (
                    <div className="w-full flex flex-col items-center gap-2 pb-6 mb-6 border-b border-cyan-500/20">
                        <span className="text-slate-500 text-[10px] uppercase tracking-[0.2em] font-medium">{t('gameover.killedBy')}</span>
                        <div className="flex items-center justify-center gap-3">
                            {stats.killerType && (
                                <span
                                    className="text-2xl filter drop-shadow-[0_0_8px_rgba(0,0,0,0.5)] relative -top-[3px]"
                                    style={{ color: stats.killerColor || '#fff' }}
                                >
                                    {UNIT_ICONS[stats.killerType]}
                                </span>
                            )}
                            <span
                                className="text-2xl font-bold tracking-wide"
                                style={{ color: stats.killerColor || '#fff' }}
                            >
                                {stats.killerName}
                            </span>
                        </div>
                    </div>
                )}

                {/* Stats Grid - HUD Style */}
                <div className="grid grid-cols-2 gap-3 w-full mb-8">
                    <StatBox label="Kings Killed" value={Math.floor(animatedKings).toString()} color="text-red-400" />
                    <StatBox label={t('gameover.coins')} value={`$${Math.floor(animatedCoins)}`} color="text-amber-400" />
                    <StatBox label={t('gameover.time')} value={formatTime(animatedTime)} color="text-cyan-400" />
                    <StatBox label="Peak Score" value={Math.floor(animatedScore).toString()} color="text-fuchsia-400" />
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-3 w-full">
                    <button
                        onClick={() => {
                            onRestart();
                            playSound('click');
                        }}
                        className={`
                            group relative w-full py-4 rounded-xl font-bold text-white uppercase tracking-[0.15em] text-sm
                            bg-gradient-to-r from-blue-600 to-cyan-500 
                            hover:from-blue-500 hover:to-cyan-400
                            shadow-[0_0_30px_rgba(14,165,233,0.4)]
                            hover:shadow-[0_0_50px_rgba(14,165,233,0.6)]
                            transition-all duration-300 transform hover:-translate-y-0.5
                            overflow-hidden
                        `}
                    >
                        <span className="relative z-10">{t('gameover.restart')}</span>
                        {/* Subtle shine effect animation */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1s_infinite]"></div>
                    </button>

                    <div className="flex gap-3">
                        <button
                            onClick={() => {
                                onMainMenu();
                                playSound('click');
                            }}
                            className="
                                flex-1 py-3 rounded-xl border border-white/10 text-slate-400 uppercase tracking-widest text-xs font-medium
                                hover:bg-white/5 hover:text-white hover:border-white/20
                                transition-all duration-200
                            "
                        >
                            {t('gameover.mainMenu')}
                        </button>

                        <button
                            onClick={() => {
                                onClose();
                                playSound('click');
                            }}
                            className="
                                flex-1 py-3 rounded-xl border border-white/10 text-slate-400 uppercase tracking-widest text-xs font-medium
                                hover:bg-white/5 hover:text-white hover:border-white/20
                                transition-all duration-200
                            "
                        >
                            Spectate
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

// Reusable Stat Component
const StatBox = ({ label, value, color }: { label: string, value: string, color: string }) => (
    <div className={`bg-black/20 rounded-xl p-3 flex flex-col items-center justify-center border border-cyan-500/20 hover:bg-cyan-500/10 transition-colors duration-300 ${color}`}>
        <span className="text-[10px] uppercase tracking-widest font-bold mb-1 opacity-80">{label}</span>
        <span className="text-3xl font-light tracking-tight drop-shadow-sm min-w-[3ch]">{value}</span>
    </div>
);
