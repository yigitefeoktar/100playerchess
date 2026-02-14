
import React, { useState } from 'react';
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

    return (
        <>
            {/* The Main Panel */}
            <div 
                className={`
                    absolute top-16 right-4 z-20 w-56 
                    glass-panel rounded-lg shadow-xl overflow-hidden pointer-events-auto
                    transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]
                    ${visible ? 'translate-x-0' : 'translate-x-[150%]'}
                `}
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
            >
                <div className="bg-cyan-900/20 px-3 py-2 border-b border-cyan-500/30 flex justify-between items-center">
                    <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider">Most Material</span>
                </div>
                <ul className="divide-y divide-cyan-500/20">
                    {entries.map((entry) => (
                        <li 
                            key={entry.playerId} 
                            className="flex justify-between items-center px-3 py-2 text-xs cursor-pointer hover:bg-white/5 transition-colors"
                            onClick={() => onPlayerClick(entry.playerId)}
                            title="Click to focus camera"
                        >
                            <div className="flex items-center gap-2">
                                <span className="w-6 text-cyan-500/70 font-mono text-right">{entry.rank}.</span>
                                <span 
                                    className="font-semibold truncate w-24"
                                    style={{ color: entry.isHuman ? '#3b82f6' : entry.color }}
                                >
                                    {entry.isHuman ? 'YOU' : `Bot ${entry.playerId.split('-')[1]}`}
                                </span>
                            </div>
                            <span className="font-mono text-slate-300">{entry.score} points</span>
                        </li>
                    ))}
                </ul>
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
