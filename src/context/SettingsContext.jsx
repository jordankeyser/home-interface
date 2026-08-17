import { useState, useEffect, useMemo, useCallback } from 'react';
import { resolveThemeId } from '../config/themes';
import {
  SettingsContext,
  DEFAULT_SETTINGS,
  STORAGE_KEY,
} from './settingsStore';

const loadSettings = () => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return DEFAULT_SETTINGS;

  try {
    const parsed = JSON.parse(saved);
    if (!parsed || typeof parsed !== 'object') return DEFAULT_SETTINGS;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      // Old installs may hold a theme id that no longer exists.
      theme: resolveThemeId(parsed.theme),
    };
  } catch (e) {
    // localStorage can end up corrupted after an unclean shutdown, which is
    // routine on a Pi that loses power.
    console.error('Invalid saved settings; resetting to defaults.', e);
    localStorage.removeItem(STORAGE_KEY);
    return DEFAULT_SETTINGS;
  }
};

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(loadSettings);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  // Themes are CSS variables keyed off this attribute.
  useEffect(() => {
    document.documentElement.dataset.theme = resolveThemeId(settings.theme);
  }, [settings.theme]);

  const updateSettings = useCallback((partial) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  const value = useMemo(
    () => ({ settings, updateSettings }),
    [settings, updateSettings]
  );

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  );
};
