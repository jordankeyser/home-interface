import React, { createContext, useState, useEffect, useContext, useMemo } from 'react';
import { getTheme } from '../config/themes';

const SettingsContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider = ({ children }) => {
    const [settings, setSettings] = useState(() => {
        const defaults = {
            ctaApiKey: '',
            ctaStationId: '40380', // Default to a station (e.g., Clark/Lake or similar)
            zipCode: '60601', // Default to Chicago Loop
            isPiMode: false,
            theme: 'dark', // Default theme
        };

        const savedSettings = localStorage.getItem('home-interface-settings');
        if (!savedSettings) return defaults;

        try {
            const parsed = JSON.parse(savedSettings);
            // Be defensive: ensure it's an object so we don't break on unexpected values.
            return (parsed && typeof parsed === 'object') ? { ...defaults, ...parsed } : defaults;
        } catch (e) {
            // If localStorage got corrupted (common after a crash), reset to defaults.
            console.error('Invalid saved settings; resetting to defaults.', e);
            localStorage.removeItem('home-interface-settings');
            return defaults;
        }
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
