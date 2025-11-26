import React, { createContext, useState, useEffect, useContext, useMemo } from 'react';
import { getTheme } from '../config/themes';

const SettingsContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider = ({ children }) => {
    const [settings, setSettings] = useState(() => {
        const savedSettings = localStorage.getItem('home-interface-settings');
        return savedSettings ? JSON.parse(savedSettings) : {
            ctaApiKey: '',
            ctaStationId: '40380', // Default to a station (e.g., Clark/Lake or similar)
            zipCode: '60601', // Default to Chicago Loop
            isPiMode: false,
            theme: 'dark', // Default theme
        };
    });

    useEffect(() => {
        localStorage.setItem('home-interface-settings', JSON.stringify(settings));
    }, [settings]);

    const updateSettings = (newSettings) => {
        setSettings((prev) => ({ ...prev, ...newSettings }));
    };

    const currentTheme = useMemo(() => getTheme(settings.theme), [settings.theme]);

    const value = useMemo(() => ({
        settings,
        updateSettings,
        currentTheme
    }), [settings, currentTheme]);

    return (
        <SettingsContext.Provider value={value}>
            {children}
        </SettingsContext.Provider>
    );
};
