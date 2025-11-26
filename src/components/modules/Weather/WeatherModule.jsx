import React, { useMemo } from 'react';
import { useWeather } from '../../../hooks/useWeather';
import { useSettings } from '../../../context/SettingsContext';

const WeatherModule = () => {
    const { weather, locationName, loading, error, refresh } = useWeather();
    const { settings, currentTheme } = useSettings();
    const isPiMode = settings.isPiMode;
    const theme = currentTheme.colors;

    const getWeatherDescription = (code) => {
        const codes = {
            0: 'Clear Sky',
            1: 'Mainly Clear', 2: 'Partly Cloudy', 3: 'Overcast',
            45: 'Fog', 48: 'Depositing Rime Fog',
            51: 'Light Drizzle', 53: 'Moderate Drizzle', 55: 'Dense Drizzle',
            61: 'Slight Rain', 63: 'Moderate Rain', 65: 'Heavy Rain',
            71: 'Slight Snow', 73: 'Moderate Snow', 75: 'Heavy Snow',
            95: 'Thunderstorm', 96: 'Thunderstorm with Hail', 99: 'Heavy Thunderstorm'
        };
        return codes[code] || 'Unknown';
    };

    const formatHour = (isoString) => {
        const date = new Date(isoString);
        return date.toLocaleTimeString([], { hour: 'numeric', hour12: true });
    };

    const renderBackground = (code) => {
        if (code === 0) {
            return (
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-[-20%] right-[-20%] w-[80%] h-[80%] bg-yellow-400/20 rounded-full blur-[100px] animate-[sun-pulse_8s_infinite]"></div>
                    <div className="absolute top-[10%] right-[10%] text-yellow-300 text-9xl opacity-20 animate-[spin_60s_linear_infinite]">☀️</div>
                </div>
            );
        }
        if (code <= 3 || code === 45 || code === 48) {
            return (
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-[10%] left-[-20%] text-gray-400/30 text-9xl animate-[cloud-drift_20s_linear_infinite]">☁️</div>
                    <div className="absolute top-[40%] left-[-10%] text-gray-300/20 text-8xl animate-[cloud-drift_25s_linear_infinite_reverse]">☁️</div>
                    <div className="absolute top-[20%] left-[-40%] text-white/10 text-[10rem] animate-[cloud-drift_30s_linear_infinite]">☁️</div>
                </div>
            );
        }
        if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
            return (
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    {[...Array(20)].map((_, i) => (
                        <div
                            key={i}
                            className="absolute top-[-10%] text-blue-300/40 text-2xl animate-[rain-fall_2s_linear_infinite]"
                            style={{
                                left: `${Math.random() * 100}%`,
                                animationDelay: `${Math.random() * 2}s`,
                                animationDuration: `${1 + Math.random()}s`
                            }}
                        >
                            💧
                        </div>
                    ))}
                </div>
            );
        }
        if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) {
            return (
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    {[...Array(15)].map((_, i) => (
                        <div
                            key={i}
                            className="absolute top-[-10%] text-white/60 text-xl animate-[snow-fall_5s_linear_infinite]"
                            style={{
                                left: `${Math.random() * 100}%`,
                                animationDelay: `${Math.random() * 5}s`,
                                animationDuration: `${3 + Math.random() * 2}s`
                            }}
                        >
                            ❄️
                        </div>
                    ))}
                </div>
            );
        }
        if (code >= 95) {
            return (
                <div className="absolute inset-0 overflow-hidden pointer-events-none bg-gray-900/40">
                    <div className="absolute inset-0 bg-white/10 animate-[pulse_0.5s_ease-in-out_infinite]"></div>
                    {[...Array(5)].map((_, i) => (
                        <div
                            key={i}
                            className="absolute top-[-10%] text-yellow-300/40 text-4xl animate-[rain-fall_0.5s_linear_infinite]"
                            style={{
                                left: `${Math.random() * 100}%`,
                                animationDelay: `${Math.random()}s`
                            }}
                        >
                            ⚡
                        </div>
                    ))}
                </div>
            );
        }
        return null;
    };

    const hourlyForecast = useMemo(() => {
        if (!weather || !weather.hourly) return [];
        const hours = [];
        const now = new Date();

        let startIndex = -1;
        for (let i = 0; i < weather.hourly.time.length; i++) {
            const hourTime = new Date(weather.hourly.time[i]);
            if (hourTime > now) {
                startIndex = i;
                break;
            }
        }

        if (startIndex !== -1) {
            for (let i = 0; i < 12 && (startIndex + i) < weather.hourly.time.length; i++) {
                const idx = startIndex + i;
                hours.push({
                    time: weather.hourly.time[idx],
                    temp: weather.hourly.temperature_2m[idx],
                    code: weather.hourly.weather_code[idx]
                });
            }
        }

        return hours;
    }, [weather]);

    if (loading && !weather) {
        return (
            <div className={`h-full w-full flex items-center justify-center ${theme.moduleBg} rounded-3xl ${theme.border} border p-6 animate-pulse`}>
                <div className={`${theme.textAccent} font-medium`}>Loading Weather...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="h-full w-full flex flex-col items-center justify-center bg-red-500/10 backdrop-blur-md rounded-3xl border border-red-500/20 p-6">
                <div className="text-red-400 font-bold mb-2">Weather Error</div>
                <div className="text-sm text-red-300 text-center mb-4">{error}</div>
                <button onClick={refresh} className="px-4 py-2 bg-red-500/20 hover:bg-red-500/40 text-red-200 rounded-lg transition-colors">Retry</button>
            </div>
        );
    }

    if (!weather) return null;

    const current = weather.current;
    const daily = weather.daily;
    const bgAnimation = renderBackground(current.weather_code);

    return (
        <div className={`h-full w-full bg-gradient-to-br ${theme.bgPrimary} rounded-3xl ${theme.border} border flex flex-col shadow-2xl relative overflow-hidden`}>
            {bgAnimation}

            <div className={`flex-grow flex flex-col items-center z-10 relative ${isPiMode ? 'justify-start pt-6' : 'justify-center -mb-12'}`}>
                <div className="text-center">
                    <h2 className={`font-light ${theme.textPrimary} opacity-80 mb-1 tracking-wide ${isPiMode ? 'text-lg' : 'text-xl'}`}>{locationName}</h2>
                    <div className={`leading-none font-bold ${theme.textPrimary} tracking-tighter drop-shadow-2xl ${isPiMode ? 'text-9xl' : 'text-8xl'}`}>
                        {Math.round(current.temperature_2m)}°
                    </div>
                    <div className={`${theme.textAccent} font-medium uppercase tracking-widest ${isPiMode ? 'text-lg mt-1' : 'text-xl mt-2'}`}>
                        {getWeatherDescription(current.weather_code)}
                    </div>
                    <div className={`${theme.textPrimary} opacity-60 mt-1 ${isPiMode ? 'text-sm' : 'text-base'}`}>
                        H: {Math.round(daily.temperature_2m_max[0])}°  L: {Math.round(daily.temperature_2m_min[0])}°
                    </div>
                </div>

                <button
                    onClick={refresh}
                    disabled={loading}
                    className={`absolute top-4 right-4 p-1.5 rounded-full ${theme.moduleHover} ${theme.buttonActive} transition-all touch-manipulation min-w-[40px] min-h-[40px] flex items-center justify-center ${loading ? 'animate-spin opacity-50' : `hover:${theme.textAccent}`}`}
                    title="Refresh Data"
                    aria-label="Refresh Weather Data"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${theme.textSecondary}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                </button>
            </div>

            <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t ${theme.bgTertiary === 'bg-gray-100' ? 'from-gray-200 via-gray-100/90' : 'from-gray-950 via-gray-900/80'} to-transparent pt-16 pb-4 px-4 z-20`}>
                <div className="flex space-x-6 overflow-x-auto pb-2 justify-center mask-image-linear-gradient scrollbar-hide touch-pan-x">
                    {hourlyForecast.map((hour, idx) => (
                        <div key={idx} className="flex flex-col items-center space-y-1 min-w-[3rem]">
                            <span className={`text-xs ${theme.textAccent} opacity-80`}>{formatHour(hour.time)}</span>
                            <span className="text-xl drop-shadow-md transform hover:scale-110 transition-transform">
                                {hour.code === 0 ? '☀️' : hour.code <= 3 ? '⛅' : hour.code <= 67 ? '🌧️' : '❄️'}
                            </span>
                            <span className={`text-base font-bold ${theme.textPrimary}`}>{Math.round(hour.temp)}°</span>
                        </div>
                    ))}
                </div>

                <div className={`w-full h-px bg-gradient-to-r from-transparent via-${theme.textPrimary}/20 to-transparent my-2`}></div>

                <div className="flex justify-around text-center px-2">
                    <div>
                        <div className={`text-[10px] ${theme.textAccent} opacity-70 uppercase tracking-wider mb-0.5`}>Wind</div>
                        <div className={`${theme.textPrimary} font-semibold text-lg`}>{Math.round(current.wind_speed_10m)} <span className="text-xs font-normal opacity-60">mph</span></div>
                    </div>
                    <div>
                        <div className={`text-[10px] ${theme.textAccent} opacity-70 uppercase tracking-wider mb-0.5`}>Humidity</div>
                        <div className={`${theme.textPrimary} font-semibold text-lg`}>{current.relative_humidity_2m}<span className="text-xs font-normal opacity-60">%</span></div>
                    </div>
                    <div>
                        <div className={`text-[10px] ${theme.textAccent} opacity-70 uppercase tracking-wider mb-0.5`}>Precip</div>
                        <div className={`${theme.textPrimary} font-semibold text-lg`}>{current.precipitation}<span className="text-xs font-normal opacity-60">"</span></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WeatherModule;
