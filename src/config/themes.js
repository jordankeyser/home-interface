/**
 * Theme registry.
 *
 * Themes are just an id + a label. All the actual styling lives in
 * `src/index.css` as CSS custom properties under `[data-theme="..."]`, which is
 * applied to <html>. Adding a theme means adding a token block there and an
 * entry here — no component changes, no class-name strings.
 */
export const themes = [
  { id: 'dark', name: 'Dark' },
  { id: 'light', name: 'Light' },
];

export const DEFAULT_THEME = 'dark';

/** Themes removed in the CSS-variable rewrite; map them onto the survivors. */
const LEGACY_THEME_MAP = {
  synth: 'dark',
  ultra: 'dark',
  vintage: 'light',
  chicago: 'light',
};

/**
 * Normalise a stored theme id. Old installs have `synth`/`ultra`/`vintage`/
 * `chicago` in localStorage, so migrate rather than silently falling back.
 */
export const resolveThemeId = (themeId) => {
  if (themes.some((t) => t.id === themeId)) return themeId;
  return LEGACY_THEME_MAP[themeId] || DEFAULT_THEME;
};
