import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

interface SoundContextType {
    isSoundEnabled: boolean;
    toggleSound: () => void;
    playSound: (soundName: SoundType) => void;
}

export type SoundType =
    | 'move' | 'capture' | 'victory' | 'defeat' | 'click' | 'coin' | 'spawn'
    | 'select' | 'error' | 'alliance' | 'betrayal' | 'infection'
    | 'menu_open' | 'menu_close' | 'tick' | 'start_game' | 'faction_change';

const SoundContext = createContext<SoundContextType | undefined>(undefined);

// Advanced synthesis helpers
const createGainEnvelope = (ctx: AudioContext, target: AudioNode, start: number, duration: number, peak: number) => {
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peak, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    gain.connect(target);
    return gain;
};

export const SoundProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isSoundEnabled, setIsSoundEnabled] = useState(() => {
        const saved = localStorage.getItem('soundEnabled');
        return saved !== 'false';
    });

    const audioCtxRef = useRef<AudioContext | null>(null);

    useEffect(() => {
        localStorage.setItem('soundEnabled', isSoundEnabled.toString());
    }, [isSoundEnabled]);

    const initAudio = () => {
        if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (audioCtxRef.current.state === 'suspended') {
            audioCtxRef.current.resume();
        }
    };

    const toggleSound = useCallback(() => {
        setIsSoundEnabled(prev => !prev);
    }, []);

    const playSound = useCallback((soundName: SoundType) => {
        if (!isSoundEnabled) return;
        initAudio();
        const ctx = audioCtxRef.current!;
        const now = ctx.currentTime;

        const master = ctx.createGain();
        master.connect(ctx.destination);
        master.gain.setValueAtTime(0.3, now);

        switch (soundName) {
            case 'move': {
                // Short FM-like blip
                const osc = ctx.createOscillator();
                const mod = ctx.createOscillator();
                const modGain = ctx.createGain();

                osc.type = 'sine';
                mod.type = 'sine';
                mod.frequency.setValueAtTime(150, now);
                modGain.gain.setValueAtTime(100, now);

                osc.frequency.setValueAtTime(400, now);
                osc.frequency.exponentialRampToValueAtTime(300, now + 0.1);

                mod.connect(modGain);
                modGain.connect(osc.frequency);

                const env = createGainEnvelope(ctx, master, now, 0.1, 0.4);
                osc.connect(env);

                osc.start(now);
                mod.start(now);
                osc.stop(now + 0.1);
                mod.stop(now + 0.1);
                break;
            }
            case 'capture': {
                // Noise-based impact
                const bufferSize = ctx.sampleRate * 0.2;
                const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

                const noise = ctx.createBufferSource();
                noise.buffer = buffer;

                const filter = ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(1000, now);
                filter.frequency.exponentialRampToValueAtTime(100, now + 0.2);

                const env = createGainEnvelope(ctx, master, now, 0.2, 0.6);
                noise.connect(filter);
                filter.connect(env);

                noise.start(now);
                noise.stop(now + 0.2);
                break;
            }
            case 'spawn':
            case 'start_game': {
                // Rising chord
                [440, 554, 659].forEach((freq, i) => {
                    const osc = ctx.createOscillator();
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(freq / 2, now + i * 0.05);
                    osc.frequency.exponentialRampToValueAtTime(freq, now + 0.3 + i * 0.05);

                    const env = createGainEnvelope(ctx, master, now + i * 0.05, 0.4, 0.2);
                    osc.connect(env);
                    osc.start(now + i * 0.05);
                    osc.stop(now + 0.5 + i * 0.05);
                });
                break;
            }
            case 'coin': {
                // High-pitched "ting"
                const osc1 = ctx.createOscillator();
                const osc2 = ctx.createOscillator();
                osc1.type = 'sine';
                osc2.type = 'sine';
                osc1.frequency.setValueAtTime(900, now);
                osc2.frequency.setValueAtTime(1800, now);

                const env = createGainEnvelope(ctx, master, now, 0.3, 0.3);
                osc1.connect(env);
                osc2.connect(env);
                osc1.start(now);
                osc2.start(now);
                osc1.stop(now + 0.3);
                osc2.stop(now + 0.3);
                break;
            }
            case 'victory': {
                // Triumphant arpeggio
                [440, 554, 659, 880].forEach((freq, i) => {
                    const osc = ctx.createOscillator();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, now + i * 0.1);
                    const env = createGainEnvelope(ctx, master, now + i * 0.1, 0.5, 0.2);
                    osc.connect(env);
                    osc.start(now + i * 0.1);
                    osc.stop(now + 0.6 + i * 0.1);
                });
                break;
            }
            case 'defeat': {
                // Descending sad tone
                const osc = ctx.createOscillator();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(200, now);
                osc.frequency.linearRampToValueAtTime(50, now + 0.8);
                const env = createGainEnvelope(ctx, master, now, 0.8, 0.3);
                osc.connect(env);
                osc.start(now);
                osc.stop(now + 0.8);
                break;
            }
            case 'menu_open':
            case 'select': {
                const osc = ctx.createOscillator();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(600, now);
                osc.frequency.exponentialRampToValueAtTime(800, now + 0.05);
                const env = createGainEnvelope(ctx, master, now, 0.05, 0.2);
                osc.connect(env);
                osc.start(now);
                osc.stop(now + 0.05);
                break;
            }
            case 'menu_close': {
                const osc = ctx.createOscillator();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(800, now);
                osc.frequency.exponentialRampToValueAtTime(600, now + 0.05);
                const env = createGainEnvelope(ctx, master, now, 0.05, 0.2);
                osc.connect(env);
                osc.start(now);
                osc.stop(now + 0.05);
                break;
            }
            case 'error': {
                const osc = ctx.createOscillator();
                osc.type = 'square';
                osc.frequency.setValueAtTime(100, now);
                const env = ctx.createGain();
                env.gain.setValueAtTime(0, now);
                env.gain.linearRampToValueAtTime(0.2, now + 0.01);
                env.gain.linearRampToValueAtTime(0, now + 0.1);
                osc.connect(env);
                env.connect(master);
                osc.start(now);
                osc.stop(now + 0.1);
                break;
            }
            case 'tick': {
                const osc = ctx.createOscillator();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(4000, now);
                const env = createGainEnvelope(ctx, master, now, 0.01, 0.1);
                osc.connect(env);
                osc.start(now);
                osc.stop(now + 0.01);
                break;
            }
            case 'faction_change': {
                const osc = ctx.createOscillator();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(300, now);
                osc.frequency.linearRampToValueAtTime(600, now + 0.1);
                const env = createGainEnvelope(ctx, master, now, 0.1, 0.2);
                osc.connect(env);
                osc.start(now);
                osc.stop(now + 0.1);
                break;
            }
            case 'click':
            default: {
                const osc = ctx.createOscillator();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(1000, now);
                const env = createGainEnvelope(ctx, master, now, 0.03, 0.15);
                osc.connect(env);
                osc.start(now);
                osc.stop(now + 0.03);
                break;
            }
        }
    }, [isSoundEnabled]);

    return (
        <SoundContext.Provider value={{ isSoundEnabled, toggleSound, playSound }}>
            {children}
        </SoundContext.Provider>
    );
};

export const useSound = () => {
    const context = useContext(SoundContext);
    if (!context) {
        throw new Error('useSound must be used within SoundProvider');
    }
    return context;
};
