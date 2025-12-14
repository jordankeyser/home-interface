import React, { useState } from 'react';
import SettingsModal from './SettingsModal';
import { useSettings } from '../context/SettingsContext';

const Layout = ({ children, isSettingsOpen, setIsSettingsOpen }) => {
    const [localSettingsOpen, setLocalSettingsOpen] = useState(false);
    const { settings, currentTheme } = useSettings();

    const isPiMode = settings.isPiMode;
    const theme = currentTheme.colors;
    const blobA = theme.blobA || 'bg-purple-600';
    const blobB = theme.blobB || 'bg-blue-600';
    const blobC = theme.blobC || 'bg-pink-600';
    const blobOpacity = theme.blobOpacity || 'opacity-20';
    const bgOverlay = theme.bgOverlay || '';
    const bgPattern = theme.bgPattern || '';

    // Use passed props if available, otherwise use local state
    const settingsOpen = isSettingsOpen !== undefined ? isSettingsOpen : localSettingsOpen;
    const setSettingsOpen = setIsSettingsOpen || setLocalSettingsOpen;

    return (
        <div className={`min-h-screen w-full ${theme.textPrimary} relative overflow-hidden flex items-center justify-center ${!isPiMode ? `bg-gradient-to-br ${theme.bgPrimary}` : 'bg-black'}`}>

            {/* Emulator Container */}
            <div
                className={`relative transition-all duration-500 ease-in-out ${isPiMode
                    ? 'overflow-hidden w-[1024px] h-[600px] border-8 border-gray-800 rounded-xl shadow-2xl bg-gray-900'
                    : 'overflow-visible w-full h-screen'
                    }`}
                style={isPiMode ? { transform: 'scale(0.85)', transformOrigin: 'center' } : {}}
            >
                {/* Background Elements (Inside Container) */}
                <div className={`absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none bg-gradient-to-br ${theme.bgPrimary}`}>
                    {/* Optional theme overlays (Ultra uses these to make the background brighter/more distinct) */}
                    {bgOverlay && <div className={`absolute inset-0 ${bgOverlay}`}></div>}
                    {bgPattern && <div className={`absolute inset-0 ${bgPattern}`}></div>}

                    <div className={`absolute top-[-10%] left-[-10%] w-96 h-96 ${blobA} rounded-full mix-blend-multiply filter blur-3xl ${blobOpacity} animate-blob`}></div>
                    <div className={`absolute top-[-10%] right-[-10%] w-96 h-96 ${blobB} rounded-full mix-blend-multiply filter blur-3xl ${blobOpacity} animate-blob animation-delay-2000`}></div>
                    <div className={`absolute bottom-[-20%] left-[20%] w-96 h-96 ${blobC} rounded-full mix-blend-multiply filter blur-3xl ${blobOpacity} animate-blob animation-delay-4000`}></div>
                </div>

                {/* Main Content Container */}
                <main className="relative z-10 h-full min-h-0 flex flex-col px-4 py-4">
                    <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[42%_58%] gap-4 overflow-visible w-full">
                        {children}
                    </div>
                </main>
            </div>

            <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
        </div>
    );
};

export default Layout;
