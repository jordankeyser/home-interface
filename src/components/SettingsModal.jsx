import React, { useState, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';

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

    const handleSubmit = (e) => {
        e.preventDefault();
        updateSettings(formData);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
                <div className="p-6">
                    <h2 className="text-xl font-bold text-white mb-4">Settings</h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
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

                        <div className="flex items-center justify-between pt-2 border-t border-gray-700">
                            <label className="text-sm font-medium text-gray-400">Simulate Raspberry Pi (7")</label>
                            <button
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, isPiMode: !prev.isPiMode }))}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.isPiMode ? 'bg-blue-600' : 'bg-gray-700'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.isPiMode ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
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
