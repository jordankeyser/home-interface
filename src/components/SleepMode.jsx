import React, { useState, useEffect, useCallback, useRef } from 'react';

// Control the physical display power via the display server
const turnDisplayOff = () => {
    fetch('http://localhost:3001/display/off', { method: 'POST' }).catch(() => {});
};

const turnDisplayOn = () => {
    fetch('http://localhost:3001/display/on', { method: 'POST' }).catch(() => {});
};

const SleepMode = ({ children }) => {
    const [isSleeping, setIsSleeping] = useState(false); // Start awake
    const [isQuitting, setIsQuitting] = useState(false);
    const timeoutRef = useRef(null);
    const scheduleCheckRef = useRef(null);
    const IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes in milliseconds

    // Check if current time is within scheduled hours
    const isScheduledWakeTime = useCallback(() => {
        const now = new Date();
        const day = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const currentTimeMinutes = hours * 60 + minutes;

        // Sunday (0) and Saturday (6): never scheduled to be on
        if (day === 0 || day === 6) {
            return false;
        }

        // Monday - Friday (1-5): scheduled from 6:30 AM to 7:30 AM Central
        if (day >= 1 && day <= 5) {
            const scheduleStart = 6 * 60 + 30; // 6:30 AM in minutes
            const scheduleEnd = 7 * 60 + 30; // 7:30 AM in minutes
            return currentTimeMinutes >= scheduleStart && currentTimeMinutes < scheduleEnd;
        }

        return false;
    }, []);

    const resetIdleTimer = useCallback(() => {
        if (isQuitting) return;

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        // Set timeout to go to sleep after 5 minutes of inactivity
        timeoutRef.current = setTimeout(() => {
            setIsSleeping(true);
            turnDisplayOff();
        }, IDLE_TIMEOUT);
    }, [isQuitting, IDLE_TIMEOUT]);

    // Check schedule and automatically wake/sleep
    const checkSchedule = useCallback(() => {
        const shouldBeAwake = isScheduledWakeTime();

        if (shouldBeAwake && isSleeping) {
            // Within scheduled time, wake up
            setIsSleeping(false);
            resetIdleTimer();
        } else if (!shouldBeAwake && !isSleeping) {
            // Outside scheduled time, check if we should sleep after idle timeout
            // Don't force sleep immediately, let the idle timer handle it
        }
    }, [isScheduledWakeTime, isSleeping, resetIdleTimer]);

    const wakeUp = useCallback(() => {
        turnDisplayOn();
        setIsSleeping(false);
        resetIdleTimer();

        // Dispatch a custom event to refresh all data when waking up
        window.dispatchEvent(new CustomEvent('wakeFromSleep'));
    }, [resetIdleTimer]);

    const handleSleepMode = useCallback(() => {
        setIsSleeping(true);
        turnDisplayOff();
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

        // Check schedule immediately on mount
        checkSchedule();

        // Set up interval to check schedule every minute
        scheduleCheckRef.current = setInterval(() => {
            checkSchedule();
        }, 60 * 1000); // Check every minute

        // Start the initial timer
        resetIdleTimer();

        // Cleanup
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            if (scheduleCheckRef.current) {
                clearInterval(scheduleCheckRef.current);
            }
            window.removeEventListener('enterSleepMode', handleSleepMode);
            window.removeEventListener('quitDashboard', handleQuit);
            events.forEach(event => {
                document.removeEventListener(event, resetIdleTimer, true);
            });
        };
    }, [resetIdleTimer, handleSleepMode, handleQuit, checkSchedule]);

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
                className="min-h-screen w-full cursor-pointer sleep-mode-screen"
                onClick={wakeUp}
                onTouchStart={wakeUp}
            />
        );
    }

    return <>{children}</>;
};

export default SleepMode;
