import React, { useState, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';
import { themes } from '../config/themes';

const SettingsModal = ({ isOpen, onClose }) => {
    const { settings, updateSettings } = useSettings();
    const [formData, setFormData] = useState(settings);

    useEffect(() => {
        if (isOpen) {
            setFormData(settings);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
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

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-gray-900">
            {/* Header */}
            <div className="flex-shrink-0 p-3 border-b border-gray-700 flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">Settings</h2>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg text-gray-300 hover:bg-gray-700 transition-colors touch-manipulation text-sm"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors font-medium touch-manipulation text-sm"
                    >
                        Save
                    </button>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="flex-1 p-3 overflow-auto">
                <div className="grid grid-cols-2 gap-3 h-full">

                    {/* Left Column - Configuration */}
                    <div className="flex flex-col gap-3">
                        {/* API Keys Section */}
                        <div className="bg-gray-800 rounded-lg p-3">
                            <h3 className="text-sm font-semibold text-gray-300 mb-2">Configuration</h3>
                            <div className="space-y-2">
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">CTA API Key</label>
                                    <input
                                        type="text"
                                        name="ctaApiKey"
                                        value={formData.ctaApiKey || ''}
                                        onChange={handleChange}
                                        className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        placeholder="API Key"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Station ID</label>
                                    <input
                                        type="text"
                                        name="ctaStationId"
                                        value={formData.ctaStationId || ''}
                                        onChange={handleChange}
                                        className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        placeholder="e.g., 40380"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Zip Code</label>
                                    <input
                                        type="text"
                                        name="zipCode"
                                        value={formData.zipCode || ''}
                                        onChange={handleChange}
                                        className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        placeholder="e.g., 60601"
                                        maxLength={5}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Theme Section */}
                        <div className="bg-gray-800 rounded-lg p-3 flex-1">
                            <h3 className="text-sm font-semibold text-gray-300 mb-2">Theme</h3>
                            <div className="grid grid-cols-2 gap-2">
                                {Object.values(themes).map((theme) => (
                                    <button
                                        key={theme.id}
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, theme: theme.id }))}
                                        className={`px-3 py-2 rounded text-sm font-medium touch-manipulation transition-all ${
                                            formData.theme === theme.id
                                                ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                        }`}
                                    >
                                        {theme.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Controls */}
                    <div className="flex flex-col gap-3">
                        {/* Display Options */}
                        <div className="bg-gray-800 rounded-lg p-3">
                            <h3 className="text-sm font-semibold text-gray-300 mb-2">Display</h3>
                            <div className="flex items-center justify-between">
                                <label className="text-sm text-gray-400">Pi Mode (7")</label>
                                <button
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, isPiMode: !prev.isPiMode }))}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.isPiMode ? 'bg-blue-600' : 'bg-gray-700'}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.isPiMode ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>
                        </div>

                        {/* Power Controls */}
                        <div className="bg-gray-800 rounded-lg p-3 flex-1">
                            <h3 className="text-sm font-semibold text-gray-300 mb-2">Power</h3>
                            <div className="grid grid-cols-1 gap-2">
                                <button
                                    type="button"
                                    onClick={handleSleep}
                                    className="w-full px-3 py-3 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 transition-colors font-medium touch-manipulation flex items-center justify-center gap-2"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                                    </svg>
                                    Sleep
                                </button>

                                <button
                                    type="button"
                                    onClick={handleQuit}
                                    className="w-full px-3 py-3 rounded-lg bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-300 transition-colors font-medium touch-manipulation flex items-center justify-center gap-2"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                    </svg>
                                    Quit
                                </button>

                                <button
                                    type="button"
                                    onClick={handleShutdown}
                                    className="w-full px-3 py-3 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-300 transition-colors font-medium touch-manipulation flex items-center justify-center gap-2"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 11-12.728 0M12 3v9" />
                                    </svg>
                                    Shutdown Pi
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
