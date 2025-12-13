import React, { useState, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';
import { themes } from '../config/themes';

const SettingsModal = ({ isOpen, onClose }) => {
    const { settings, updateSettings } = useSettings();
    const [formData, setFormData] = useState(settings);
    const [showKeys, setShowKeys] = useState({
        ctaApiKey: false,
        ctaStationId: false,
        zipCode: false
    });

    useEffect(() => {
        if (isOpen) {
            setFormData(settings);
            setShowKeys({ ctaApiKey: false, ctaStationId: false, zipCode: false });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const toggleShowKey = (key) => {
        setShowKeys(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleSubmit = () => {
        updateSettings(formData);
        onClose();
    };

    const handleSleep = () => {
        fetch('http://localhost:3001/display/off', { method: 'POST' }).catch(() => {});
        window.dispatchEvent(new CustomEvent('enterSleepMode'));
        onClose();
    };

    const handleQuit = () => {
        if (window.confirm('Are you sure you want to quit the dashboard?')) {
            window.dispatchEvent(new CustomEvent('quitDashboard'));
            onClose();
        }
    };

    const handleShutdown = async () => {
        if (window.confirm('Are you sure you want to shutdown the Raspberry Pi?')) {
            try {
                await fetch('http://localhost:3001/shutdown', { method: 'POST' });
            } catch (error) {
                console.error('Shutdown failed:', error);
                alert('Failed to shutdown.');
            }
            onClose();
        }
    };

    const EyeIcon = ({ show, onClick }) => (
        <button
            type="button"
            onClick={onClick}
            className="p-1 text-gray-500 hover:text-gray-300 transition-colors touch-manipulation"
        >
            {show ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
            ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
            )}
        </button>
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-gray-900">
            {/* Header */}
            <div className="flex-shrink-0 p-2 border-b border-gray-700 flex items-center justify-between">
                <h2 className="text-base font-bold text-white">Settings</h2>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-3 py-1.5 rounded text-gray-300 hover:bg-gray-700 transition-colors touch-manipulation text-sm"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        className="px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-500 transition-colors font-medium touch-manipulation text-sm"
                    >
                        Save
                    </button>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="flex-1 p-2">
                <div className="grid grid-cols-2 gap-2 h-full">

                    {/* Left Column - Configuration */}
                    <div className="bg-gray-800 rounded-lg p-2">
                        <h3 className="text-xs font-semibold text-gray-400 mb-2">Configuration</h3>
                        <div className="space-y-2">
                            <div>
                                <label className="block text-xs text-gray-500 mb-0.5">CTA API Key</label>
                                <div className="flex items-center gap-1">
                                    <input
                                        type={showKeys.ctaApiKey ? 'text' : 'password'}
                                        name="ctaApiKey"
                                        value={formData.ctaApiKey || ''}
                                        onChange={handleChange}
                                        className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        placeholder="API Key"
                                    />
                                    <EyeIcon show={showKeys.ctaApiKey} onClick={() => toggleShowKey('ctaApiKey')} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-0.5">Station ID</label>
                                <div className="flex items-center gap-1">
                                    <input
                                        type={showKeys.ctaStationId ? 'text' : 'password'}
                                        name="ctaStationId"
                                        value={formData.ctaStationId || ''}
                                        onChange={handleChange}
                                        className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        placeholder="e.g., 40380"
                                    />
                                    <EyeIcon show={showKeys.ctaStationId} onClick={() => toggleShowKey('ctaStationId')} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-0.5">Zip Code</label>
                                <div className="flex items-center gap-1">
                                    <input
                                        type={showKeys.zipCode ? 'text' : 'password'}
                                        name="zipCode"
                                        value={formData.zipCode || ''}
                                        onChange={handleChange}
                                        className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        placeholder="e.g., 60601"
                                        maxLength={5}
                                    />
                                    <EyeIcon show={showKeys.zipCode} onClick={() => toggleShowKey('zipCode')} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Power & Theme */}
                    <div className="bg-gray-800 rounded-lg p-2 flex flex-col">
                        <h3 className="text-xs font-semibold text-gray-400 mb-2">Power</h3>
                        <div className="grid grid-cols-3 gap-1.5 mb-3">
                            <button
                                type="button"
                                onClick={handleSleep}
                                className="px-2 py-2 rounded bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 transition-colors font-medium touch-manipulation flex flex-col items-center justify-center gap-1 text-xs"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                                </svg>
                                Sleep
                            </button>

                            <button
                                type="button"
                                onClick={handleQuit}
                                className="px-2 py-2 rounded bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-300 transition-colors font-medium touch-manipulation flex flex-col items-center justify-center gap-1 text-xs"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                                Quit
                            </button>

                            <button
                                type="button"
                                onClick={handleShutdown}
                                className="px-2 py-2 rounded bg-red-600/20 hover:bg-red-600/30 text-red-300 transition-colors font-medium touch-manipulation flex flex-col items-center justify-center gap-1 text-xs"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 11-12.728 0M12 3v9" />
                                </svg>
                                Shutdown
                            </button>
                        </div>

                        <h3 className="text-xs font-semibold text-gray-400 mb-2">Theme</h3>
                        <div className="grid grid-cols-2 gap-1.5 flex-1">
                            {Object.values(themes).map((theme) => (
                                <button
                                    key={theme.id}
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, theme: theme.id }))}
                                    className={`px-2 py-1.5 rounded text-xs font-medium touch-manipulation transition-all ${
                                        formData.theme === theme.id
                                            ? 'bg-blue-600 text-white ring-1 ring-blue-400'
                                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                    }`}
                                >
                                    {theme.name}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
