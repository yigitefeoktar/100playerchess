import React from 'react';
import { Player } from '../types';
import { UNIT_ICONS } from '../constants';
import { useTranslation } from '../i18n';
import { useSound } from '../sound';

interface SpectatorGameOverModalProps {
    winner: Player;
    totalTime: number;
    onRestart: () => void;
    onMainMenu: () => void;
}

export const SpectatorGameOverModal: React.FC<SpectatorGameOverModalProps> = ({
    winner,
    totalTime,
    onRestart,
    onMainMenu
}) => {
    const { t } = useTranslation();
    const { playSound } = useSound();

    // --- ANIMATION HOOK ---
    const useAnimatedValue = (target: number, duration: number = 1500) => {
        const [value, setValue] = React.useState(0);
        React.useEffect(() => {
            let start = 0;
            const startTime = performance.now();
            const animate = (currentTime: number) => {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
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

    const animatedKings = useAnimatedValue(winner.kingsKilled);
    const animatedCredits = useAnimatedValue(winner.totalCollected);
    const animatedTime = useAnimatedValue(totalTime);
    const animatedPeak = useAnimatedValue(winner.peakMaterial);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 animate-fade-in backdrop-blur-sm">
            <div
                className={`
                    relative w-[32rem] glass-panel rounded-2xl p-8 
                    shadow-[0_0_50px_rgba(34,211,238,0.25)]
                    flex flex-col items-center text-center
                    animate-modal-pop
                    overflow-hidden
                `}
            >
                {/* Decorative top sheen */}
                <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>

                {/* Header */}
                <div className="space-y-2 mb-8 w-full">
                    <h1 className={`text-5xl font-extrabold uppercase tracking-widest bg-clip-text text-transparent bg-gradient-to-b from-cyan-300 via-cyan-100 to-blue-400 drop-shadow-sm`}>
                        BATTLE CONCLUDED
                    </h1>
                    <div className="flex items-center justify-center gap-3 py-2 px-4 bg-white/5 rounded-full border border-white/5 mx-auto w-fit">
                        <span className="text-cyan-400 text-[10px] uppercase tracking-widest font-bold">Winner Spotlight</span>
                        <div className="h-3 w-px bg-white/10"></div>
                        <div className="flex items-center gap-2">
                            <span className="text-xl relative -top-[2px]" style={{ color: winner.color }}>{UNIT_ICONS['KING']}</span>
                            <span className="text-white font-bold tracking-wide">{winner.isHuman ? "You" : `Bot ${winner.id.split('-')[1]}`}</span>
                        </div>
                    </div>
                </div>

                {/* Stats Grid - Mirroring Normal Modal */}
                <div className="grid grid-cols-2 gap-3 w-full mb-8">
                    <StatBox label="Kings Killed" value={Math.floor(animatedKings).toString()} color="text-red-400" />
                    <StatBox label={t('gameover.coins')} value={`$${Math.floor(animatedCredits)}`} color="text-amber-400" />
                    <StatBox label="Simulated Time" value={formatTime(animatedTime)} color="text-cyan-400" />
                    <StatBox label="Peak Score" value={Math.floor(animatedPeak).toString()} color="text-fuchsia-400" />
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
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1s_infinite]"></div>
                    </button>

                    <button
                        onClick={() => {
                            onMainMenu();
                            playSound('click');
                        }}
                        className="
                            w-full py-3 rounded-xl border border-white/10 text-slate-400 uppercase tracking-widest text-xs font-medium
                            hover:bg-white/5 hover:text-white hover:border-white/20
                            transition-all duration-200
                        "
                    >
                        {t('gameover.mainMenu')}
                    </button>
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
