import React, { useState, useEffect, useCallback, useRef } from 'react';

const SleepMode = ({ children }) => {
    const [isSleeping, setIsSleeping] = useState(false);
    const [isQuitting, setIsQuitting] = useState(false);
    const timeoutRef = useRef(null);
    const IDLE_TIMEOUT = 15 * 60 * 1000; // 15 minutes in milliseconds

    const resetIdleTimer = useCallback(() => {
        if (isSleeping || isQuitting) return;

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
            setIsSleeping(true);
        }, IDLE_TIMEOUT);
    }, [isSleeping, isQuitting]);

    const wakeUp = useCallback(() => {
        setIsSleeping(false);
        resetIdleTimer();
    }, [resetIdleTimer]);

    const handleSleepMode = useCallback(() => {
        setIsSleeping(true);
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
    }, []);

    const handleQuit = useCallback(() => {
        setIsQuitting(true);
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
    }, []);

    const handleRestart = () => {
        setIsQuitting(false);
        setIsSleeping(false);
        resetIdleTimer();
    };

    useEffect(() => {
        // Set up event listeners for sleep and quit
        window.addEventListener('enterSleepMode', handleSleepMode);
        window.addEventListener('quitDashboard', handleQuit);

        // Set up activity listeners for idle timeout
        const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

        events.forEach(event => {
            document.addEventListener(event, resetIdleTimer, true);
        });

        // Start the initial timer
        resetIdleTimer();

        // Cleanup
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            window.removeEventListener('enterSleepMode', handleSleepMode);
            window.removeEventListener('quitDashboard', handleQuit);
            events.forEach(event => {
                document.removeEventListener(event, resetIdleTimer, true);
            });
        };
    }, [resetIdleTimer, handleSleepMode, handleQuit]);

    if (isQuitting) {
        return (
            <div className="min-h-screen w-full bg-gradient-to-br from-gray-900 via-slate-800 to-black flex items-center justify-center">
                <div className="text-center p-8">
                    <div className="mb-6">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24 mx-auto text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    <h1 className="text-4xl font-bold text-white mb-4">Dashboard Closed</h1>
                    <p className="text-xl text-gray-400 mb-8">Click the button below to restart the dashboard</p>
                    <button
                        onClick={handleRestart}
                        className="px-8 py-4 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-xl font-semibold text-lg transition-colors shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 touch-manipulation min-h-[56px]"
                    >
                        Restart Dashboard
                    </button>
                </div>
            </div>
        );
    }

    if (isSleeping) {
        return (
            <div
                className="min-h-screen w-full bg-black flex items-center justify-center cursor-pointer"
                onClick={wakeUp}
                onTouchStart={wakeUp}
            >
                <div className="text-center opacity-30 hover:opacity-50 transition-opacity">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-32 w-32 mx-auto text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                    <p className="text-2xl text-gray-600">Tap to wake</p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
};

export default SleepMode;
