import React from 'react';
import { UnitType } from '../types';
import { UNIT_ICONS, COLORS, FACTION_COLORS } from '../constants';

interface SandboxToolbarProps {
    selectedTeam: string;
    setSelectedTeam: (id: string) => void;
    selectedUnit: UnitType;
    setSelectedUnit: (type: UnitType) => void;
    brushSize: number;
    setBrushSize: (size: number) => void;
    brushShape: 'square' | 'circle';
    setBrushShape: (shape: 'square' | 'circle') => void;
    isSimulationRunning: boolean;
    onToggleSimulation: () => void;
    onClearMap: () => void;
}

const TEAMS = FACTION_COLORS.map(fc => ({
    id: `sandbox-${fc.id}`,
    label: fc.name.substring(0, 3).toUpperCase(),
    color: fc.hex
}));

const BRUSH_UNITS: { type: UnitType; label: string }[] = [
    { type: UnitType.PAWN, label: 'Pawn' },
    { type: UnitType.KNIGHT, label: 'Knight' },
    { type: UnitType.BISHOP, label: 'Bishop' },
    { type: UnitType.ROOK, label: 'Rook' },
    { type: UnitType.QUEEN, label: 'Queen' },
    { type: UnitType.KING, label: 'King' },
];

const BRUSH_SIZES = [
    { value: 1, label: '1×1' },
    { value: 3, label: '3×3' },
    { value: 5, label: '5×5' },
];

export const SandboxToolbar: React.FC<SandboxToolbarProps> = ({
    selectedTeam, setSelectedTeam,
    selectedUnit, setSelectedUnit,
    brushSize, setBrushSize,
    brushShape, setBrushShape,
    isSimulationRunning, onToggleSimulation,
    onClearMap,
}) => {
    return (
        <div
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 pointer-events-auto"
            onMouseDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
        >
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl
                backdrop-blur-xl bg-black/50 border border-white/10
                shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.05)]"
            >
                {/* Section 1: Team Palette */}
                <div className="flex flex-col items-center gap-1">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-white/30">Team</span>
                    <div className="flex gap-1">
                        {TEAMS.map(team => (
                            <button
                                key={team.id}
                                onClick={() => setSelectedTeam(team.id)}
                                className={`w-8 h-8 rounded-lg border-2 transition-all duration-150 flex items-center justify-center text-[9px] font-black
                                    ${selectedTeam === team.id
                                        ? 'border-white shadow-[0_0_12px_rgba(255,255,255,0.3)] scale-110'
                                        : 'border-white/20 hover:border-white/40 opacity-70 hover:opacity-100'
                                    }`}
                                style={{ backgroundColor: team.color + '33', color: team.color }}
                                title={team.label}
                            >
                                {team.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Divider */}
                <div className="w-px h-10 bg-white/10"></div>

                {/* Section 2: Unit Brush */}
                <div className="flex flex-col items-center gap-1">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-white/30">Brush</span>
                    <div className="flex gap-0.5">
                        {BRUSH_UNITS.map(({ type, label }) => (
                            <button
                                key={type}
                                onClick={() => setSelectedUnit(type)}
                                className={`w-8 h-8 rounded-lg border transition-all duration-150 flex items-center justify-center text-lg
                                    ${selectedUnit === type
                                        ? 'border-yellow-400 bg-yellow-400/20 shadow-[0_0_10px_rgba(250,204,21,0.3)] scale-110'
                                        : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20'
                                    }`}
                                title={label}
                            >
                                <span style={{ color: selectedUnit === type ? '#fbbf24' : '#94a3b8' }}>
                                    {UNIT_ICONS[type]}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Divider */}
                <div className="w-px h-10 bg-white/10"></div>

                {/* Section 3: Brush Settings */}
                <div className="flex flex-col items-center gap-1">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-white/30">Size</span>
                    <div className="flex gap-1 items-center">
                        {BRUSH_SIZES.map(({ value, label }) => (
                            <button
                                key={value}
                                onClick={() => setBrushSize(value)}
                                className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all duration-150
                                    ${brushSize === value
                                        ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-400/50'
                                        : 'bg-white/5 text-white/40 border border-white/10 hover:bg-white/10 hover:text-white/60'
                                    }`}
                            >
                                {label}
                            </button>
                        ))}
                        <button
                            onClick={() => setBrushShape(brushShape === 'square' ? 'circle' : 'square')}
                            className="px-2 py-1 rounded-md text-[10px] font-bold bg-white/5 text-white/40 border border-white/10
                                hover:bg-white/10 hover:text-white/60 transition-all duration-150"
                            title={`Shape: ${brushShape}`}
                        >
                            {brushShape === 'square' ? '■' : '●'}
                        </button>
                    </div>
                </div>

                {/* Divider */}
                <div className="w-px h-10 bg-white/10"></div>

                {/* Section 4: Controls */}
                <div className="flex flex-col items-center gap-1">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-white/30">Control</span>
                    <div className="flex gap-1">
                        {/* Play/Pause */}
                        <button
                            onClick={onToggleSimulation}
                            className={`w-9 h-8 rounded-lg border transition-all duration-150 flex items-center justify-center
                                ${isSimulationRunning
                                    ? 'border-green-400/50 bg-green-500/20 text-green-400 shadow-[0_0_10px_rgba(34,197,94,0.2)]'
                                    : 'border-yellow-400/50 bg-yellow-500/10 text-yellow-400'
                                }`}
                            title={isSimulationRunning ? 'Pause' : 'Play'}
                        >
                            {isSimulationRunning ? (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                    <rect x="6" y="4" width="4" height="16" rx="1" />
                                    <rect x="14" y="4" width="4" height="16" rx="1" />
                                </svg>
                            ) : (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                    <polygon points="5,3 19,12 5,21" />
                                </svg>
                            )}
                        </button>

                        {/* Trash */}
                        <button
                            onClick={onClearMap}
                            className="w-9 h-8 rounded-lg border border-red-400/30 bg-red-500/10 text-red-400
                                hover:bg-red-500/20 hover:border-red-400/50 transition-all duration-150 flex items-center justify-center"
                            title="Clear Map"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                        </button>

                        {/* Save (Placeholder) */}
                        <button
                            className="w-9 h-8 rounded-lg border border-white/10 bg-white/5 text-white/20
                                cursor-not-allowed flex items-center justify-center"
                            title="Save (Coming Soon)"
                            disabled
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                                <polyline points="17 21 17 13 7 13 7 21" />
                                <polyline points="7 3 7 8 15 8" />
                            </svg>
                        </button>

                        {/* Load (Placeholder) */}
                        <button
                            className="w-9 h-8 rounded-lg border border-white/10 bg-white/5 text-white/20
                                cursor-not-allowed flex items-center justify-center"
                            title="Load (Coming Soon)"
                            disabled
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
