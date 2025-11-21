import { useState, useEffect, useCallback } from 'react';
import { useSettings } from '../context/SettingsContext';

export const useCTA = () => {
    const { settings } = useSettings();
    const [arrivals, setArrivals] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [stationName, setStationName] = useState('');
    const [isPaused, setIsPaused] = useState(false);

    const fetchArrivals = useCallback(async () => {
        if (isPaused) return; // Skip fetch if paused

        if (!settings.ctaApiKey || !settings.ctaStationId) {
            setError('API Key and Station ID are required');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // Use local proxy if available (matches vite.config.js)
            const baseUrl = '/api/1.0/ttarrivals.aspx';
            const url = `${baseUrl}?key=${settings.ctaApiKey}&mapid=${settings.ctaStationId}&outputType=JSON`;

            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.ctatt.errCd !== "0") {
                throw new Error(data.ctatt.errNm || 'Unknown CTA API Error');
            }

            const etas = data.ctatt.eta || [];
            setArrivals(etas);

            // Extract station name from the first result if available
            if (etas.length > 0) {
                setStationName(etas[0].staNm);
            }

            setLastUpdated(new Date());
        } catch (err) {
            console.error("Failed to fetch CTA data:", err);
            setError(err.message || 'Failed to fetch data');
        } finally {
            setLoading(false);
        }
    }, [settings.ctaApiKey, settings.ctaStationId, isPaused]);

    // Auto-refresh every 10 seconds
    useEffect(() => {
        fetchArrivals();
        const interval = setInterval(fetchArrivals, 10000);
        return () => clearInterval(interval);
    }, [fetchArrivals]);

    const togglePause = () => setIsPaused(prev => !prev);

    return { arrivals, loading, error, lastUpdated, refresh: fetchArrivals, stationName, isPaused, togglePause };
};
