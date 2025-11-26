import React, { useState, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';

const SettingsModal = ({ isOpen, onClose }) => {
    const { settings, updateSettings } = useSettings();
    const [formData, setFormData] = useState(settings);
    const [openSections, setOpenSections] = useState({
        keys: false,
        utility: false,
        theme: false
    });

    useEffect(() => {
        if (isOpen) {
            setFormData(settings);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const toggleSection = (section) => {
        setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        updateSettings(formData);
        onClose();
    };

    const handleSleep = () => {
        // Dispatch custom event for sleep mode
        window.dispatchEvent(new CustomEvent('enterSleepMode'));
        onClose();
    };

    const handleQuit = () => {
        if (window.confirm('Are you sure you want to quit the dashboard?')) {
            // Dispatch custom event for quit
            window.dispatchEvent(new CustomEvent('quitDashboard'));
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
                <div className="p-6">
                    <h2 className="text-xl font-bold text-white mb-4">Settings</h2>
                    <form onSubmit={handleSubmit} className="space-y-3">

                        {/* Keys Section */}
                        <div className="border border-gray-700 rounded-lg overflow-hidden">
                            <button
                                type="button"
                                onClick={() => toggleSection('keys')}
                                className="w-full flex items-center justify-between p-3 bg-gray-900/50 hover:bg-gray-900 transition-colors"
                            >
                                <span className="text-sm font-semibold text-white">Keys</span>
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className={`h-5 w-5 text-gray-400 transition-transform ${openSections.keys ? 'rotate-180' : ''}`}
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                            {openSections.keys && (
                                <div className="p-4 space-y-4 bg-gray-900/30">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-1">CTA API Key</label>
                                        <input
                                            type="text"
                                            name="ctaApiKey"
                                            value={formData.ctaApiKey || ''}
                                            onChange={handleChange}
                                            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="Enter your CTA API Key"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-1">Station ID (MapID)</label>
                                        <input
                                            type="text"
                                            name="ctaStationId"
                                            value={formData.ctaStationId || ''}
                                            onChange={handleChange}
                                            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="e.g., 40380"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Use the 5-digit MapID (e.g., 40380 for Clark/Lake)</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-1">Zip Code</label>
                                        <input
                                            type="text"
                                            name="zipCode"
                                            value={formData.zipCode || ''}
                                            onChange={handleChange}
                                            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="e.g., 60601"
                                            maxLength={5}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Utility Section */}
                        <div className="border border-gray-700 rounded-lg overflow-hidden">
                            <button
                                type="button"
                                onClick={() => toggleSection('utility')}
                                className="w-full flex items-center justify-between p-3 bg-gray-900/50 hover:bg-gray-900 transition-colors"
                            >
                                <span className="text-sm font-semibold text-white">Utility</span>
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className={`h-5 w-5 text-gray-400 transition-transform ${openSections.utility ? 'rotate-180' : ''}`}
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                            {openSections.utility && (
                                <div className="p-4 space-y-4 bg-gray-900/30">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-medium text-gray-400">Simulate Raspberry Pi (7")</label>
                                        <button
                                            type="button"
                                            onClick={() => setFormData(prev => ({ ...prev, isPiMode: !prev.isPiMode }))}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.isPiMode ? 'bg-blue-600' : 'bg-gray-700'}`}
                                        >
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.isPiMode ? 'translate-x-6' : 'translate-x-1'}`} />
                                        </button>
                                    </div>

                                    <div className="pt-2 border-t border-gray-700 space-y-2">
                                        <button
                                            type="button"
                                            onClick={handleSleep}
                                            className="w-full px-4 py-3 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 hover:text-blue-200 transition-colors font-medium touch-manipulation flex items-center justify-center gap-2"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                                            </svg>
                                            Sleep
                                        </button>

                                        <button
                                            type="button"
                                            onClick={handleQuit}
                                            className="w-full px-4 py-3 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-300 hover:text-red-200 transition-colors font-medium touch-manipulation flex items-center justify-center gap-2"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                            </svg>
                                            Quit
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Theme Section */}
                        <div className="border border-gray-700 rounded-lg overflow-hidden">
                            <button
                                type="button"
                                onClick={() => toggleSection('theme')}
                                className="w-full flex items-center justify-between p-3 bg-gray-900/50 hover:bg-gray-900 transition-colors"
                            >
                                <span className="text-sm font-semibold text-white">Theme</span>
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className={`h-5 w-5 text-gray-400 transition-transform ${openSections.theme ? 'rotate-180' : ''}`}
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                            {openSections.theme && (
                                <div className="p-4 space-y-4 bg-gray-900/30">
                                    <p className="text-sm text-gray-500 italic">Coming soon...</p>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end space-x-3 mt-6">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-6 py-3 rounded-lg text-gray-300 hover:text-white hover:bg-gray-700 active:bg-gray-600 transition-colors touch-manipulation min-h-[48px]"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-6 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-500 active:bg-blue-700 transition-colors font-medium touch-manipulation min-h-[48px]"
                            >
                                Save Changes
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
