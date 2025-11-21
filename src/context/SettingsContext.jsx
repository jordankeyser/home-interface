import React, { createContext, useState, useEffect, useContext, useMemo } from 'react';

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
        };
    });

    useEffect(() => {
        localStorage.setItem('home-interface-settings', JSON.stringify(settings));
    }, [settings]);

    const updateSettings = (newSettings) => {
        setSettings((prev) => ({ ...prev, ...newSettings }));
    };

    const value = useMemo(() => ({ settings, updateSettings }), [settings]);

    return (
        <SettingsContext.Provider value={value}>
            {children}
        </SettingsContext.Provider>
    );
};
