import { useState, useEffect, useCallback } from 'react';
import { useSettings } from '../context/SettingsContext';

export const useWeather = () => {
    const { settings } = useSettings();
    const [weather, setWeather] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [locationName, setLocationName] = useState('');

    const fetchWeather = useCallback(async () => {
        if (!settings.zipCode) {
            setError('Zip Code is required');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // 1. Geocoding: Zip -> Lat/Lon
            const geoRes = await fetch(`https://api.zippopotam.us/us/${settings.zipCode}`);
            if (!geoRes.ok) throw new Error('Invalid Zip Code');

            const geoData = await geoRes.json();
            const place = geoData.places[0];
            const lat = place.latitude;
            const lon = place.longitude;
            setLocationName(`${place['place name']}, ${place['state abbreviation']}`);

            // 2. Weather: Open-Meteo
            // Added hourly=temperature_2m,weather_code for the forecast
            const weatherRes = await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,snowfall,weather_code,cloud_cover,wind_speed_10m&hourly=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=auto&forecast_days=2`
            );

            if (!weatherRes.ok) throw new Error('Failed to fetch weather data');

            const weatherData = await weatherRes.json();
            setWeather(weatherData);
        } catch (err) {
            console.error("Weather fetch error:", err);
            setError(err.message || 'Failed to load weather');
        } finally {
            setLoading(false);
        }
    }, [settings.zipCode]);

    // Refresh every 15 minutes
    useEffect(() => {
        fetchWeather();
        const interval = setInterval(fetchWeather, 15 * 60 * 1000);
        return () => clearInterval(interval);
    }, [fetchWeather]);

    return { weather, locationName, loading, error, refresh: fetchWeather };
};
