import { createContext } from 'react';

/**
 * Context object and constants live in their own module so `SettingsContext.jsx`
 * exports only components (which is what react-refresh needs to hot-reload it).
 */
export const SettingsContext = createContext(null);

export const STORAGE_KEY = 'home-interface-settings';

export const DEFAULT_SETTINGS = {
  ctaApiKey: '',
  ctaStationId: '40380',
  zipCode: '60601',
  stockProvider: 'finnhub',
  stockApiKey: '',
  stockSymbols: 'AAPL, MSFT, TSLA',
  /** Minutes of inactivity before the panel sleeps. 0 disables sleep. */
  idleSleepMinutes: 3,
  /** Dim the backlight on a day/night curve instead of only sleeping. */
  ambientDimming: true,
  /** Preview the 1024x600 panel while developing on a desktop browser. */
  isPiMode: false,
  theme: 'dark',
};
