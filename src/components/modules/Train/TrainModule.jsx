import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useCTA } from '../../../hooks/useCTA';

const TrainModule = () => {
    const { arrivals, loading, error, lastUpdated, refresh, stationName, isPaused, togglePause } = useCTA();

    // Local state to manage the list with exit animations
    const [displayedArrivals, setDisplayedArrivals] = useState([]);
    const [exitingTrainIds, setExitingTrainIds] = useState(new Set());
    const prevArrivalsRef = useRef([]);

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


    // Group arrivals by destination/direction
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
        return groups;
    }, [displayedArrivals]);

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
            <div className="h-full w-full flex items-center justify-center bg-white/5 backdrop-blur-md rounded-3xl border border-white/10 p-6 animate-pulse">
                <div className="text-blue-400 font-medium">Loading Train Data...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="h-full w-full flex flex-col items-center justify-center bg-red-500/10 backdrop-blur-md rounded-3xl border border-red-500/20 p-6">
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
        <div className="h-full w-full bg-white/5 backdrop-blur-md rounded-3xl border border-white/10 p-4 flex flex-col shadow-xl relative overflow-hidden">

            <div className="flex justify-between items-center mb-2">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <span className="w-1.5 h-6 bg-blue-500 rounded-full"></span>
                    {stationName ? `${stationName} Arrivals` : 'Train Arrivals'}
                </h2>
                <div className="flex items-center gap-2">
                    {lastUpdated && (
                        <span className="text-[10px] text-gray-400 hidden sm:block">
                            Updated: {lastUpdated.toLocaleTimeString()}
                        </span>
                    )}

                    {/* Pause/Play Button */}
                    <button
                        onClick={togglePause}
                        className={`p-3 rounded-full hover:bg-white/10 active:bg-white/20 transition-all touch-manipulation min-w-[48px] min-h-[48px] flex items-center justify-center ${isPaused ? 'text-yellow-400' : 'text-gray-300 hover:text-blue-400'}`}
                        title={isPaused ? "Resume Updates" : "Pause Updates"}
                        aria-label={isPaused ? "Resume Updates" : "Pause Updates"}
                    >
                        {isPaused ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                        )}
                    </button>

                    <button
                        onClick={refresh}
                        disabled={loading || isPaused}
                        className={`p-3 rounded-full hover:bg-white/10 active:bg-white/20 transition-all touch-manipulation min-w-[48px] min-h-[48px] flex items-center justify-center ${loading ? 'animate-spin opacity-50' : 'hover:text-blue-400'}`}
                        title="Refresh Data"
                        aria-label="Refresh Train Data"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>
                </div>
            </div>

            <div className="flex-grow overflow-y-auto space-y-4 pr-1 custom-scrollbar">
                {Object.keys(groupedArrivals).length === 0 ? (
                    <div className="text-center text-gray-500 mt-10">No trains scheduled</div>
                ) : (
                    Object.entries(groupedArrivals).map(([direction, trains]) => (
                        <div key={direction}>
                            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 border-b border-white/5 pb-1">
                                {direction}
                            </h3>
                            <div className="space-y-2 relative">
                                {trains.slice(0, 3).map((train) => {
                                    const mins = getMinutes(train.arrT);
                                    const isDue = mins === 'Due';
                                    const isExiting = exitingTrainIds.has(train.rn);

                                    return (
                                        <div
                                            key={train.rn}
                                            className={`flex items-center justify-between bg-white/5 p-2 rounded-lg hover:bg-white/10 transition-all duration-1000 group ${isExiting ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                {/* Line Color Badge (No Text) */}
                                                <div className={`w-2 h-6 rounded-full ${getLineColor(train.rt)} shadow-lg group-hover:scale-110 transition-transform`}></div>

                                                <div>
                                                    <div className="font-bold text-white text-base leading-tight">{train.destNm}</div>
                                                    <div className="text-[10px] text-gray-500">Run #{train.rn}</div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className={`text-xl font-bold ${isDue ? 'text-yellow-400 animate-pulse' : 'text-white'}`}>
                                                    {isDue ? 'Due' : mins}
                                                </div>
                                                <div className="text-[10px] text-gray-400">
                                                    {!isDue && <span className="mr-1 opacity-70">est</span>}
                                                    {formatTime(train.arrT)}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default TrainModule;
