import React from 'react';
import { useTranslation } from '../i18n';

export const OrientationOverlay: React.FC = () => {
    const { t } = useTranslation();

    return (
        <div className="orientation-overlay fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#050a0f] text-center p-8 select-none pointer-events-auto">
            <div className="phone-rotate-icon mb-8">
                <svg width="80" height="120" viewBox="0 0 80 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="10" y="10" width="60" height="100" rx="4" stroke="#00f0ff" strokeWidth="4" />
                    <circle cx="40" cy="100" r="4" fill="#00f0ff" />
                    <rect x="25" y="15" width="30" height="2" rx="1" fill="#00f0ff" opacity="0.5" />
                </svg>
            </div>
            <h2 className="text-2xl font-bold text-white uppercase tracking-widest mb-4">
                {t('orientation.rotate')}
            </h2>
            <p className="text-cyan-400/70 text-sm max-w-[240px] leading-relaxed">
                {t('orientation.message')}
            </p>
            <style>{`
                .orientation-overlay {
                    display: none;
                }

                @media (max-width: 768px) and (orientation: portrait) {
                    .orientation-overlay {
                        display: flex;
                    }
                }

                @keyframes phoneRotate {
                    0% { transform: rotate(0deg); }
                    30% { transform: rotate(-90deg); }
                    70% { transform: rotate(-90deg); }
                    100% { transform: rotate(0deg); }
                }

                .phone-rotate-icon {
                    animation: phoneRotate 2s cubic-bezier(0.16, 1, 0.3, 1) infinite;
                }
            `}</style>
        </div>
    );
};
