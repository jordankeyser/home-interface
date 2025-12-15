import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useCTA } from '../../../hooks/useCTA';
import { useSettings } from '../../../context/SettingsContext';

const TrainModule = () => {
    const { arrivals, loading, error, lastUpdated, refresh, stationName, isPaused, togglePause } = useCTA();
    const { currentTheme } = useSettings();
    const theme = currentTheme.colors;
    const moduleCard = theme.moduleCard || `${theme.moduleBg} ${theme.border} border shadow-xl rounded-3xl`;
    const moduleCardInner = theme.moduleCardInner || theme.bgSecondary;

    // Local state to manage the list with exit animations
    const [displayedArrivals, setDisplayedArrivals] = useState([]);
    const [exitingTrainIds, setExitingTrainIds] = useState(new Set());
    const [expandedDirections, setExpandedDirections] = useState(() => new Set());
    const prevArrivalsRef = useRef([]);
    const moduleRef = useRef(null);
    const scrollContainerRef = useRef(null);

    // Helper to calculate minutes until arrival
    const getMinutes = (arrivalString) => {
        const now = new Date();
        const arrival = new Date(arrivalString);
        const diffMs = arrival - now;
        const diffMins = Math.round(diffMs / 60000);
        return diffMins <= 0 ? 'Due' : `${diffMins} min`;
    };

    // Sync arrivals with local state and handle exit animations
    useEffect(() => {
        if (loading && arrivals.length === 0) return;

        const currentIds = new Set(arrivals.map(t => t.rn));
        const prevArrivals = prevArrivalsRef.current;

        // 1. Identify trains that have departed (were present, now missing, and were "Due")
        const departingTrains = prevArrivals.filter(t => {
            const isMissing = !currentIds.has(t.rn);
            const mins = getMinutes(t.arrT);
            const wasDue = mins === 'Due' || mins === '1 min';
            return isMissing && wasDue;
        });

        if (departingTrains.length > 0) {
            // Mark them as exiting
            const departingIds = departingTrains.map(t => t.rn);
            setExitingTrainIds(prev => {
                const next = new Set(prev);
                departingIds.forEach(id => next.add(id));
                return next;
            });

            // Wait for animation (e.g., 1s) then remove them and update list
            setTimeout(() => {
                setExitingTrainIds(prev => {
                    const next = new Set(prev);
                    departingIds.forEach(id => next.delete(id));
                    return next;
                });
                // Update displayed list to match new API data
                setDisplayedArrivals(arrivals);
            }, 1000); // Match CSS animation duration
        } else {
            // No departures, just update the list (e.g., time updates, new trains)
            // If we are currently animating an exit, don't overwrite yet
            if (exitingTrainIds.size === 0) {
                setDisplayedArrivals(arrivals);
            }
        }

        prevArrivalsRef.current = arrivals;
    }, [arrivals, loading, exitingTrainIds.size]);

    // Enable scrolling from anywhere on the module (wheel + touch)
    useEffect(() => {
        const moduleElement = moduleRef.current;
        const scrollContainer = scrollContainerRef.current;

        if (!moduleElement || !scrollContainer) return;

        let touchStartY = 0;
        let touchStartScrollTop = 0;

        const handleWheel = (e) => {
            e.preventDefault();
            e.stopPropagation();
            scrollContainer.scrollTop += e.deltaY;
        };

        const handleTouchStart = (e) => {
            touchStartY = e.touches[0].clientY;
            touchStartScrollTop = scrollContainer.scrollTop;
        };

        const handleTouchMove = (e) => {
            const touchY = e.touches[0].clientY;
            const deltaY = touchStartY - touchY;
            scrollContainer.scrollTop = touchStartScrollTop + deltaY;
            e.preventDefault();
        };

        moduleElement.addEventListener('wheel', handleWheel, { passive: false });
        moduleElement.addEventListener('touchstart', handleTouchStart, { passive: true });
        moduleElement.addEventListener('touchmove', handleTouchMove, { passive: false });

        return () => {
            moduleElement.removeEventListener('wheel', handleWheel);
            moduleElement.removeEventListener('touchstart', handleTouchStart);
            moduleElement.removeEventListener('touchmove', handleTouchMove);
        };
    }, []);

    // Refresh data when waking from sleep
    useEffect(() => {
        const handleWakeFromSleep = () => {
            refresh();
        };

        window.addEventListener('wakeFromSleep', handleWakeFromSleep);

        return () => {
            window.removeEventListener('wakeFromSleep', handleWakeFromSleep);
        };
    }, [refresh]);

    // Determine if Loop should be first based on day of week
    const isLoopFirst = useMemo(() => {
        const day = new Date().getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        // Monday-Thursday (1-4): Loop first
        // Friday-Sunday (5, 6, 0): Kimball first
        return day >= 1 && day <= 4;
    }, []);

    // Group arrivals by destination/direction and sort by arrival time
    const groupedArrivals = useMemo(() => {
        const groups = {};
        // Use displayedArrivals instead of raw arrivals
        displayedArrivals.forEach(train => {
            const key = train.stpDe || train.destNm;
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(train);
        });
        // Sort each group by arrival time (soonest first)
        Object.keys(groups).forEach(key => {
            groups[key].sort((a, b) => new Date(a.arrT) - new Date(b.arrT));
        });
        return groups;
    }, [displayedArrivals]);

    // Sort direction groups based on day of week
    const sortedDirections = useMemo(() => {
        const entries = Object.entries(groupedArrivals);
        return entries.sort((a, b) => {
            const aIsLoop = a[0].toLowerCase().includes('loop');
            const bIsLoop = b[0].toLowerCase().includes('loop');

            if (isLoopFirst) {
                // Loop should be first (Mon-Thu)
                if (aIsLoop && !bIsLoop) return -1;
                if (!aIsLoop && bIsLoop) return 1;
            } else {
                // Kimball should be first (Fri-Sun)
                if (aIsLoop && !bIsLoop) return 1;
                if (!aIsLoop && bIsLoop) return -1;
            }
            return 0;
        });
    }, [groupedArrivals, isLoopFirst]);

    const toggleDirectionExpanded = (direction) => {
        setExpandedDirections((prev) => {
            const next = new Set(prev);
            if (next.has(direction)) next.delete(direction);
            else next.add(direction);
            return next;
        });
    };

    // Helper to format time
    const formatTime = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    // Helper for line color
    const getLineColor = (route) => {
        const colors = {
            'Red': 'bg-red-600',
            'Blue': 'bg-blue-600',
            'Brn': 'bg-yellow-700',
            'G': 'bg-green-600',
            'Org': 'bg-orange-600',
            'P': 'bg-purple-600',
            'Pink': 'bg-pink-500',
            'Y': 'bg-yellow-400',
        };
        return colors[route] || 'bg-gray-600';
    };

    if (loading && arrivals.length === 0) {
        return (
            <div className={`h-full w-full flex items-center justify-center ${moduleCard} p-6 animate-pulse`}>
                <div className={`${theme.textAccent} font-medium`}>Loading Train Data...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={`h-full w-full flex flex-col items-center justify-center bg-red-500/10 backdrop-blur-md rounded-3xl ring-1 ring-red-500/30 p-6`}>
                <div className="text-red-400 font-bold mb-2">Connection Error</div>
                <div className="text-sm text-red-300 text-center mb-4">{error}</div>
                <button
                    onClick={refresh}
                    className="px-4 py-2 bg-red-500/20 hover:bg-red-500/40 text-red-200 rounded-lg transition-colors"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div ref={moduleRef} className={`h-full w-full min-w-0 ${moduleCard} p-3 flex flex-col relative overflow-hidden`}>

            <div className="flex justify-between items-center mb-2 gap-3">
                <h2 className={`min-w-0 text-base md:text-lg font-bold ${theme.textPrimary} flex items-center gap-2`}>
                    <span className={`w-1.5 h-6 ${theme.accentColor} rounded-full`}></span>
                    <span className="truncate">{stationName || 'Trains'}</span>
                </h2>
                <div className="flex items-center -space-x-1 flex-shrink-0">
                    {lastUpdated && (
                        <span className={`text-[10px] ${theme.textSecondary} whitespace-nowrap hidden md:block mr-1`}>
                            Updated {lastUpdated.toLocaleTimeString()}
                        </span>
                    )}

                    {/* Pause/Play Button */}
                    <button
                        onClick={togglePause}
                        className={`p-1.5 rounded-full ${theme.moduleHover} ${theme.buttonActive} transition-all touch-manipulation min-w-[40px] min-h-[40px] flex items-center justify-center ${isPaused ? 'text-yellow-400' : `${theme.textSecondary} ${theme.textAccent}`}`}
                        title={isPaused ? "Resume Updates" : "Pause Updates"}
                        aria-label={isPaused ? "Resume Updates" : "Pause Updates"}
                    >
                        {isPaused ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                        )}
                    </button>

                    <button
                        onClick={refresh}
                        disabled={loading || isPaused}
                        className={`p-1.5 rounded-full ${theme.moduleHover} ${theme.buttonActive} transition-all touch-manipulation min-w-[40px] min-h-[40px] flex items-center justify-center ${loading ? 'animate-spin opacity-50' : `hover:${theme.textAccent}`}`}
                        title="Refresh Data"
                        aria-label="Refresh Train Data"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${theme.textSecondary}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Inset scroll area so the scrollbar is not flush against the module edge */}
            <div className="flex-grow min-h-0 pr-3">
                <div
                    ref={scrollContainerRef}
                    className="h-full overflow-y-auto overflow-x-hidden space-y-3 custom-scrollbar pr-2 pb-6 train-scroll-mask"
                >
                    {sortedDirections.length === 0 ? (
                        <div className={`text-center ${theme.textSecondary} mt-10`}>No trains scheduled</div>
                    ) : (
                    sortedDirections.map(([direction, trains], directionIndex) => (
                            <div key={direction}>
                                <button
                                    type="button"
                                    onClick={() => toggleDirectionExpanded(direction)}
                                    className={`w-full flex items-center justify-between gap-2 mb-2 border-b ${theme.border} pb-1 text-left ${theme.moduleHover} rounded-lg px-2 -mx-2 transition-colors`}
                                    aria-label={`${expandedDirections.has(direction) ? 'Collapse' : 'Expand'} ${direction}`}
                                    title={expandedDirections.has(direction) ? 'Show fewer trains' : 'Show more trains'}
                                >
                                    <h3 className={`min-w-0 text-xs font-medium ${theme.textSecondary} uppercase tracking-wider truncate`}>
                                        {direction}
                                    </h3>
                                    <span className="flex-shrink-0 p-1.5 rounded-full">
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            className={`h-4 w-4 ${theme.textSecondary} transition-transform ${expandedDirections.has(direction) ? 'rotate-180' : ''}`}
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </span>
                                </button>
                                <div className="space-y-2 relative">
                                    {(() => {
                                        const defaultCount = directionIndex === 0 ? 3 : 2;
                                        const count = expandedDirections.has(direction) ? defaultCount + 2 : defaultCount;
                                        return trains.slice(0, count).map((train) => {
                                        const mins = getMinutes(train.arrT);
                                        const isDue = mins === 'Due';
                                        const isExiting = exitingTrainIds.has(train.rn);

                                        return (
                                            <div
                                                key={train.rn}
                                                className={`flex items-center justify-between ${moduleCardInner} px-2 py-1 rounded-xl ${theme.moduleHover} ring-1 ring-white/10 transition-all duration-1000 group ${isExiting ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'}`}
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    {/* Line Color Badge (No Text) */}
                                                    <div className={`w-2 h-4 rounded-full ${getLineColor(train.rt)} shadow-lg group-hover:scale-110 transition-transform`}></div>

                                                    <div className="min-w-0">
                                                        <div className={`font-bold ${theme.textPrimary} text-sm leading-tight truncate`}>{train.destNm}</div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className={`text-base font-bold ${isDue ? 'text-yellow-400 animate-pulse' : theme.textPrimary}`}>
                                                        {isDue ? 'Due' : mins}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                        });
                                    })()}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default TrainModule;
