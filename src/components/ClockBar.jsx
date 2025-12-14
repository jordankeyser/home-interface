import React, { useState, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';

const ClockBar = ({ onSettingsClick }) => {
    const [time, setTime] = useState(new Date());
    const { currentTheme } = useSettings();
    const theme = currentTheme.colors;
    const barCard = theme.moduleCard || `${theme.moduleBg} ${theme.border} border shadow-lg rounded-xl`;

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Refresh time immediately when waking from sleep
    useEffect(() => {
        const handleWakeFromSleep = () => {
            setTime(new Date());
        };

        window.addEventListener('wakeFromSleep', handleWakeFromSleep);

        return () => {
            window.removeEventListener('wakeFromSleep', handleWakeFromSleep);
        };
    }, []);

    const formatTime = (date) => {
        return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    };

    const formatDate = (date) => {
        return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
    };

    return (
        <div className={`w-full ${barCard} p-6 flex justify-between items-center mb-3 relative`}>
            <div className="flex flex-col gap-1">
                <div className={`text-3xl font-bold ${theme.textPrimary} tracking-tight leading-none`}>
                    {formatTime(time)}
                </div>
                <div className={`text-sm ${theme.textAccent} font-medium uppercase tracking-wider`}>
                    {formatDate(time)}
                </div>
            </div>
            <button
                onClick={onSettingsClick}
                className={`p-3 rounded-full ${theme.buttonBg} ${theme.buttonHover} ${theme.buttonActive} transition-colors ${theme.textSecondary} hover:${theme.textPrimary} absolute right-4 touch-manipulation min-w-[48px] min-h-[48px] flex items-center justify-center`}
                aria-label="Open Settings"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
            </button>
        </div>
    );
};

export default ClockBar;
