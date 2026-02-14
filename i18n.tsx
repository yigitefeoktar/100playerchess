import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'en' | 'tr';

interface Translations {
    [key: string]: {
        en: string;
        tr: string;
    };
}

const translations: Translations = {
    // Main Menu
    'menu.title': { en: '100 Player Chess', tr: '100 Oyunculu Satranç' },
    'menu.factionColor': { en: 'Faction Color', tr: 'Takım Rengi' },
    'menu.difficulty': { en: 'Difficulty', tr: 'Zorluk' },
    'menu.difficulty.easy': { en: 'Easy', tr: 'Kolay' },
    'menu.difficulty.medium': { en: 'Medium', tr: 'Orta' },
    'menu.difficulty.hard': { en: 'Hard', tr: 'Zor' },
    'menu.gameMode': { en: 'Game Mode', tr: 'Oyun Modu' },
    'menu.gameMode.change': { en: 'Change', tr: 'Değiştir' },
    'menu.gameMode.select': { en: 'Select Game Mode', tr: 'Oyun Modu Seç' },
    'menu.start': { en: 'Start the Game', tr: 'Oyunu Başlat' },
    'menu.darkMode': { en: 'Dark Mode', tr: 'Karanlık Mod' },
    'menu.lightMode': { en: 'Light Mode', tr: 'Aydınlık Mod' },

    // Game Modes
    'mode.standard': { en: 'STANDARD', tr: 'STANDART' },
    'mode.standard.desc': { en: 'Classic Battle Royale. 100 Players.', tr: 'Klasik Battle Royale. 100 Oyuncu.' },
    'mode.adventure': { en: 'ADVENTURE', tr: 'MACERA' },
    'mode.adventure.desc': { en: 'Explore the world. Survive the wilds.', tr: 'Dünyayı keşfet. Vahşi doğada hayatta kal.' },
    'mode.bullet': { en: 'BULLET', tr: 'MERMI' },
    'mode.bullet.desc': { en: '2x Speed. No Mercy. All Bots attack constantly.', tr: '2x Hız. Merhamet Yok. Tüm Botlar sürekli saldırır.' },
    'mode.diplomacy': { en: 'DIPLOMACY', tr: 'DİPLOMASİ' },
    'mode.diplomacy.desc': { en: 'Form Alliances. Betray your friends.', tr: 'İttifak Kur. Arkadaşlarını İhanet Et.' },
    'mode.zombies': { en: 'ZOMBIES', tr: 'ZOMBİLER' },
    'mode.zombies.desc': { en: 'Survive the horde. Infection spreads on contact.', tr: 'Hordaya Karşı Hayatta Kal. Temas ile bulaşır.' },
    'mode.sandbox': { en: 'SANDBOX', tr: 'KUM HAVUZU' },
    'mode.sandbox.desc': { en: 'Creative Mode. Paint units. Test strategies.', tr: 'Yaratıcı Mod. Birim boya. Strateji dene.' },

    // Game Over
    'gameover.victory': { en: 'VICTORY ROYALE', tr: 'ZAFER' },
    'gameover.eliminated': { en: 'ELIMINATED', tr: 'ELENDİN' },
    'gameover.killedBy': { en: 'Killed by', tr: 'Öldüren' },
    'gameover.survivor': { en: 'Last Survivor', tr: 'Son Kalan' },
    'gameover.kills': { en: 'Total Kills', tr: 'Toplam Öldürme' },
    'gameover.coins': { en: 'Coins Collected', tr: 'Toplanan Altın' },
    'gameover.time': { en: 'Time Survived', tr: 'Hayatta Kalma Süresi' },
    'gameover.material': { en: 'Peak Material', tr: 'En Yüksek Materyal' },
    'gameover.restart': { en: 'Play Again', tr: 'Tekrar Oyna' },
    'gameover.mainMenu': { en: 'Main Menu', tr: 'Ana Menü' },

    // HUD
    'hud.players': { en: 'Players', tr: 'Oyuncu' },
    'hud.leaderboard': { en: 'Leaderboard', tr: 'Liderlik Tablosu' },
    'hud.shop': { en: 'Shop', tr: 'Mağaza' },
    'hud.help': { en: 'Help', tr: 'Yardım' },
    'hud.resign': { en: 'Resign', tr: 'Pes Et' },
    'hud.menu': { en: 'Menu', tr: 'Menü' },
    'hud.peaceTime': { en: 'PEACE TIME', tr: 'BARIŞ SÜRESİ' },
    'hud.wave': { en: 'Wave', tr: 'Dalga' },

    // Shop
    'shop.title': { en: 'Shop', tr: 'Mağaza' },
    'shop.credits': { en: 'Credits', tr: 'Altın' },

    // Confirm Dialogs
    'confirm.resign': { en: 'Are you sure you want to resign?', tr: 'Pes etmek istediğinizden emin misiniz?' },
    'confirm.mainMenu': { en: 'Return to Main Menu?', tr: 'Ana Menüye Dön?' },
    'confirm.yes': { en: 'Yes', tr: 'Evet' },
    'confirm.no': { en: 'No', tr: 'Hayır' },
};

interface I18nContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [language, setLanguageState] = useState<Language>(() => {
        const saved = localStorage.getItem('language');
        return (saved === 'tr' || saved === 'en') ? saved : 'en';
    });

    useEffect(() => {
        localStorage.setItem('language', language);
    }, [language]);

    const setLanguage = (lang: Language) => {
        setLanguageState(lang);
    };

    const t = (key: string): string => {
        const translation = translations[key];
        if (!translation) {
            console.warn(`Missing translation for key: ${key}`);
            return key;
        }
        return translation[language] || translation.en || key;
    };

    return (
        <I18nContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </I18nContext.Provider>
    );
};

export const useTranslation = () => {
    const context = useContext(I18nContext);
    if (!context) {
        throw new Error('useTranslation must be used within I18nProvider');
    }
    return context;
};
