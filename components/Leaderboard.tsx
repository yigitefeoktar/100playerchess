
import React, { useState, useEffect, useRef } from 'react';
import { LeaderboardEntry } from '../types';

interface LeaderboardProps {
    entries: LeaderboardEntry[];
    visible: boolean;
    onPlayerClick: (playerId: string) => void;
    onClose: () => void;
    onOpen: () => void;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ entries, visible, onPlayerClick, onClose, onOpen }) => {
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchY, setTouchY] = useState<number | null>(null);
    const [sortBy, setSortBy] = useState<'score' | 'kills' | 'kings' | 'coins' | 'lost'>('score');

    // Trend tracking
    const previousStatsRef = useRef<Record<string, { score: number; kills: number; kings: number; coins: number; lost: number }>>({});
    const activeTrendsRef = useRef<Record<string, { dir: 'up' | 'down'; expiresAt: number }>>({});
    const [trends, setTrends] = useState<Record<string, 'up' | 'down' | 'none'>>({});

    useEffect(() => {
        const now = Date.now();
        let stateNeedsUpdate = false;

        entries.forEach(entry => {
            const p = previousStatsRef.current[entry.playerId];
            let currentVal = entry.score;
            if (sortBy === 'kills') currentVal = entry.kills;
            else if (sortBy === 'kings') currentVal = entry.kingsKilled;
            else if (sortBy === 'coins') currentVal = entry.coins;
            else if (sortBy === 'lost') currentVal = entry.unitsLost;

            // 1. Detect instant changes
            if (p) {
                let prevVal = p.score;
                if (sortBy === 'kills') prevVal = p.kills;
                else if (sortBy === 'kings') prevVal = p.kings;
                else if (sortBy === 'coins') prevVal = p.coins;
                else if (sortBy === 'lost') prevVal = p.lost;

                if (currentVal > prevVal) {
                    activeTrendsRef.current[entry.playerId] = { dir: 'up', expiresAt: now + 2000 };
                    stateNeedsUpdate = true;
                } else if (currentVal < prevVal) {
                    activeTrendsRef.current[entry.playerId] = { dir: 'down', expiresAt: now + 2000 };
                    stateNeedsUpdate = true;
                }
            }
            previousStatsRef.current[entry.playerId] = {
                score: entry.score,
                kills: entry.kills,
                kings: entry.kingsKilled,
                coins: entry.coins,
                lost: entry.unitsLost
            };

            // 2. Expire old trends
            const active = activeTrendsRef.current[entry.playerId];
            if (active && now > active.expiresAt) {
                delete activeTrendsRef.current[entry.playerId];
                stateNeedsUpdate = true;
            }
        });

        // 3. Commit to state if any new trends fired or expired
        if (stateNeedsUpdate) {
            setTrends(prev => {
                const newTrends: Record<string, 'up' | 'down' | 'none'> = {};
                let isDifferent = false;

                entries.forEach(entry => {
                    const active = activeTrendsRef.current[entry.playerId];
                    const dir = active ? active.dir : 'none';
                    newTrends[entry.playerId] = dir;
                    if (prev[entry.playerId] !== dir) {
                        isDifferent = true;
                    }
                });

                return isDifferent ? newTrends : prev;
            });
        }
    }, [entries, sortBy]);

    const onTouchStart = (e: React.TouchEvent) => {
        setTouchStart(e.targetTouches[0].clientX);
        setTouchY(e.targetTouches[0].clientY);
    };

    const onTouchEnd = (e: React.TouchEvent) => {
        if (touchStart === null || touchY === null) return;
        const touchEnd = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;
        const diff = touchStart - touchEnd;
        const diffY = Math.abs(touchY - touchEndY);

        // Ignore if vertical swipe dominates
        if (diffY > Math.abs(diff)) {
            setTouchStart(null);
            setTouchY(null);
            return;
        }

        const SWIPE_THRESHOLD = 50;

        // Swipe Left (Open) - detect from trigger
        if (diff > SWIPE_THRESHOLD && !visible) {
            onOpen();
        }
        // Swipe Right (Close) - detect from panel
        else if (diff < -SWIPE_THRESHOLD && visible) {
            onClose();
        }
        setTouchStart(null);
        setTouchY(null);
    };

    // Sort and rank
    const sortedEntries = [...entries].sort((a, b) => {
        if (a.isEliminated !== b.isEliminated) return a.isEliminated ? 1 : -1;
        if (sortBy === 'score' && a.score !== b.score) return b.score - a.score;
        if (sortBy === 'kills' && a.kills !== b.kills) return b.kills - a.kills;
        if (sortBy === 'kings' && a.kingsKilled !== b.kingsKilled) return b.kingsKilled - a.kingsKilled;
        if (sortBy === 'coins' && a.coins !== b.coins) return b.coins - a.coins;
        if (sortBy === 'lost' && a.unitsLost !== b.unitsLost) return b.unitsLost - a.unitsLost;
        return b.score - a.score; // Fallback
    }).map((e, index) => ({ ...e, rank: index + 1 }));

    // Extract Top 8
    let displayEntries = sortedEntries.slice(0, 8);
    const humanEntry = sortedEntries.find(e => e.isHuman);

    // Pin human if outside Top 8
    if (humanEntry && humanEntry.rank > 8) {
        displayEntries = [...sortedEntries.slice(0, 7), humanEntry];
    }

    const getRankIcon = (rank: number) => {
        if (rank === 1) return '👑';
        if (rank === 2) return '🥈';
        if (rank === 3) return '🥉';
        return `${rank}.`;
    };

    const getRankColor = (rank: number) => {
        if (rank === 1) return 'text-yellow-400 font-bold';
        if (rank === 2) return 'text-slate-300 font-bold';
        if (rank === 3) return 'text-amber-600 font-bold';
        return 'text-cyan-500/70';
    };

    return (
        <>
            {/* The Main Panel */}
            <div
                className={`
                    absolute top-16 right-4 z-20 w-56 
                    glass-panel rounded-lg shadow-xl overflow-hidden pointer-events-auto
                    transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]
                    flex flex-col
                    ${visible ? 'translate-x-0' : 'translate-x-[150%]'}
                `}
                style={{ maxHeight: '80vh' }}
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
            >
                <div className="bg-slate-900/60 backdrop-blur-md px-3 py-3 border-b border-cyan-500/30 flex flex-col items-center gap-1 shrink-0 relative overflow-hidden">
                    {/* Subtle top glow */}
                    <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent"></div>

                    {/* Animated Icon Buttons Row (Top) */}
                    <div className="flex w-full justify-between items-center px-1 py-1">
                        {(['score', 'kills', 'kings', 'coins', 'lost'] as const).map((type) => {
                            const isActive = sortBy === type;
                            const icons = { score: '♟️', kills: '⚔️', kings: '💀', coins: '💰', lost: '📉' };
                            const titles = { score: 'Sort by Material', kills: 'Sort by Kills', kings: 'Sort by Kings Assassinated', coins: 'Sort by Wealth (Coins)', lost: 'Sort by Units Lost' };

                            return (
                                <button
                                    key={type}
                                    className={`
                                        relative w-8 h-8 rounded-lg flex items-center justify-center text-sm
                                        transition-all duration-300 ease-out transform
                                        ${isActive
                                            ? 'bg-cyan-500/20 shadow-[0_0_12px_rgba(34,211,238,0.5)] scale-110 text-white border border-cyan-400/50 z-10'
                                            : 'bg-black/60 text-white/50 border border-white/5 hover:bg-white/10 hover:text-white hover:scale-110 hover:border-white/20 active:scale-95'
                                        }
                                    `}
                                    onClick={() => setSortBy(type)}
                                    title={titles[type]}
                                >
                                    {isActive && <div className="absolute inset-0 rounded-lg bg-cyan-400/10 animate-pulse pointer-events-none"></div>}
                                    <span className="relative z-10 drop-shadow-md flex items-center justify-center w-full h-full leading-none">{icons[type]}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Dynamic Title (Bottom) */}
                    <div className="flex items-center justify-center w-full mt-2 h-4">
                        <span className="text-[10px] font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-blue-400 uppercase tracking-[0.15em] animate-[fadeIn_0.2s_ease-out]">
                            {sortBy === 'score' && 'Most Material'}
                            {sortBy === 'kills' && 'Most Kills'}
                            {sortBy === 'kings' && 'Kings Assassinated'}
                            {sortBy === 'coins' && 'Wealth'}
                            {sortBy === 'lost' && 'Units Lost'}
                        </span>
                    </div>
                </div>
                <div className="overflow-y-auto custom-scrollbar flex-1">
                    <ul className="divide-y divide-cyan-500/20">
                        {displayEntries.map((entry) => (
                            <li
                                key={entry.playerId}
                                className="flex justify-between items-center px-3 py-2 text-xs cursor-pointer hover:bg-white/10 transition-colors"
                                onClick={() => onPlayerClick(entry.playerId)}
                                title="Click to focus camera"
                            >
                                <div className="flex items-center gap-2">
                                    <span className={`w-6 font-mono text-center ${getRankColor(entry.rank)}`}>
                                        {getRankIcon(entry.rank)}
                                    </span>
                                    <span
                                        className="font-semibold truncate w-24 drop-shadow-md"
                                        style={{ color: entry.isHuman ? '#3b82f6' : entry.color }}
                                    >
                                        {entry.isHuman ? 'YOU' : `Bot ${entry.playerId.split('-')[1]}`}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1">
                                    {trends[entry.playerId] === 'up' && <span className="text-[10px] text-green-400">▲</span>}
                                    {trends[entry.playerId] === 'down' && <span className="text-[10px] text-red-400">▼</span>}
                                    <span className="font-mono text-slate-300">
                                        {sortBy === 'score' && `${entry.score} pts`}
                                        {sortBy === 'kills' && `${entry.kills} ⚔️`}
                                        {sortBy === 'kings' && `${entry.kingsKilled} 💀`}
                                        {sortBy === 'coins' && `${entry.coins} 💰`}
                                        {sortBy === 'lost' && `${entry.unitsLost} 📉`}
                                    </span>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            {/* Invisible Swipe Trigger (Only when Hidden) */}
            {!visible && (
                <div
                    className="absolute top-16 right-0 w-8 h-64 z-20 pointer-events-auto"
                    onTouchStart={onTouchStart}
                    onTouchEnd={onTouchEnd}
                />
            )}
        </>
    );
};
