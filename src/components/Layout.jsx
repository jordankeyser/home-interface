import React, { useState } from 'react';
import SettingsModal from './SettingsModal';
import { useSettings } from '../context/SettingsContext';

const Layout = ({ children, isSettingsOpen, setIsSettingsOpen }) => {
    const [localSettingsOpen, setLocalSettingsOpen] = useState(false);
    const { settings } = useSettings();

    const isPiMode = settings.isPiMode;

    // Use passed props if available, otherwise use local state
    const settingsOpen = isSettingsOpen !== undefined ? isSettingsOpen : localSettingsOpen;
    const setSettingsOpen = setIsSettingsOpen || setLocalSettingsOpen;

    return (
        <div className={`min-h-screen w-full bg-black text-white relative overflow-hidden flex items-center justify-center ${!isPiMode ? 'bg-gradient-to-br from-gray-900 via-slate-800 to-black' : ''}`}>

            {/* Emulator Container */}
            <div
                className={`relative overflow-hidden transition-all duration-500 ease-in-out ${isPiMode
                    ? 'w-[1024px] h-[600px] border-8 border-gray-800 rounded-xl shadow-2xl bg-gray-900'
                    : 'w-full h-screen'
                    }`}
            >
                {/* Background Elements (Inside Container) */}
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none bg-gradient-to-br from-gray-900 via-slate-800 to-black">
                    <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
                    <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-blue-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
                    <div className="absolute bottom-[-20%] left-[20%] w-96 h-96 bg-pink-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
                </div>

                {/* Main Content Container */}
                <main className="relative z-10 h-full flex flex-col p-4">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-[45%_55%] gap-3 overflow-hidden">
                        {children}
                    </div>
                </main>
            </div>

            <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
        </div>
    );
};

export default Layout;
