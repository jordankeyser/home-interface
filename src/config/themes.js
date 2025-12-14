export const themes = {
  dark: {
    id: 'dark',
    name: 'Dark Mode',
    colors: {
      // Background
      bgPrimary: 'from-gray-900 via-slate-800 to-black',
      bgSecondary: 'bg-white/5',
      bgTertiary: 'bg-gray-900',

      // Text
      textPrimary: 'text-white',
      textSecondary: 'text-gray-400',
      textAccent: 'text-blue-400',

      // Borders - more pronounced
      border: 'border-white/30',
      borderAccent: 'border-blue-500',

      // Module backgrounds
      moduleBg: 'bg-white/5 backdrop-blur-md',
      moduleHover: 'hover:bg-white/10',

      // Buttons
      buttonBg: 'bg-white/5',
      buttonHover: 'hover:bg-white/10',
      buttonActive: 'active:bg-white/20',

      // Accent colors
      accent: 'blue',
      accentColor: 'bg-blue-500'
    }
  },

  light: {
    id: 'light',
    name: 'Light Mode',
    colors: {
      // Background - clean white with subtle cool tones
      bgPrimary: 'from-slate-100 via-white to-slate-50',
      bgSecondary: 'bg-slate-200/80',
      bgTertiary: 'bg-white',

      // Text - high contrast with modern slate tones
      textPrimary: 'text-slate-900',
      textSecondary: 'text-slate-500',
      textAccent: 'text-indigo-600',

      // Borders - more pronounced
      border: 'border-slate-400',
      borderAccent: 'border-indigo-500',

      // Module backgrounds
      moduleBg: 'bg-white/80 backdrop-blur-md',
      moduleHover: 'hover:bg-white/90',

      // Buttons - clean and minimal
      buttonBg: 'bg-slate-100',
      buttonHover: 'hover:bg-slate-200',
      buttonActive: 'active:bg-slate-300',

      // Accent colors - modern indigo
      accent: 'indigo',
      accentColor: 'bg-indigo-500'
    }
  },

  synth: {
    id: 'synth',
    name: 'Retro Synth',
    colors: {
      // Background
      bgPrimary: 'from-purple-900 via-pink-900 to-black',
      bgSecondary: 'bg-pink-500/10',
      bgTertiary: 'bg-purple-900',

      // Text
      textPrimary: 'text-pink-100',
      textSecondary: 'text-purple-300',
      textAccent: 'text-cyan-400',

      // Borders - more pronounced
      border: 'border-pink-500/50',
      borderAccent: 'border-cyan-400',

      // Module backgrounds
      moduleBg: 'bg-purple-900/60 backdrop-blur-md',
      moduleHover: 'hover:bg-pink-500/20',

      // Buttons
      buttonBg: 'bg-pink-500/20',
      buttonHover: 'hover:bg-pink-500/30',
      buttonActive: 'active:bg-pink-500/40',

      // Accent colors
      accent: 'cyan',
      accentColor: 'bg-cyan-400'
    }
  },

  vintage: {
    id: 'vintage',
    name: 'Vintage Computer',
    colors: {
      // Background
      bgPrimary: 'from-amber-50 via-orange-50 to-yellow-50',
      bgSecondary: 'bg-amber-100/50',
      bgTertiary: 'bg-orange-100',

      // Text
      textPrimary: 'text-amber-900',
      textSecondary: 'text-orange-700',
      textAccent: 'text-red-600',

      // Borders - more pronounced
      border: 'border-amber-500',
      borderAccent: 'border-red-600',

      // Module backgrounds
      moduleBg: 'bg-amber-100/80 backdrop-blur-sm',
      moduleHover: 'hover:bg-amber-200/60',

      // Buttons
      buttonBg: 'bg-amber-200/50',
      buttonHover: 'hover:bg-amber-300/60',
      buttonActive: 'active:bg-amber-400/60',

      // Accent colors
      accent: 'amber',
      accentColor: 'bg-amber-600'
    }
  },

  chicago: {
    id: 'chicago',
    name: 'Chicago Colors',
    colors: {
      // Background
      bgPrimary: 'from-slate-200 via-gray-300 to-slate-300',
      bgSecondary: 'bg-gray-400/30',
      bgTertiary: 'bg-gray-200',

      // Text
      textPrimary: 'text-black',
      textSecondary: 'text-gray-700',
      textAccent: 'text-blue-700',

      // Borders - more pronounced
      border: 'border-gray-600',
      borderAccent: 'border-blue-700',

      // Module backgrounds
      moduleBg: 'bg-gray-200/90 backdrop-blur-sm',
      moduleHover: 'hover:bg-gray-300/70',

      // Buttons
      buttonBg: 'bg-gray-300',
      buttonHover: 'hover:bg-gray-400',
      buttonActive: 'active:bg-gray-500',

      // Accent colors
      accent: 'blue',
      accentColor: 'bg-blue-700'
    }
  },

  ultra: {
    id: 'ultra',
    name: 'Ultra Modern',
    colors: {
      // Background - deep dark mode with a modern, multi-accent undertone
      // (Use arbitrary hex to avoid washed-out Tailwind grays on large displays.)
      bgPrimary: 'from-[#05060A] via-[#080F1F] to-[#020409]',
      bgSecondary: 'bg-white/6',
      bgTertiary: 'bg-black/40',

      // Text - crisp and restrained (accent is used sparingly)
      textPrimary: 'text-slate-50',
      textSecondary: 'text-slate-400',
      textAccent: 'text-cyan-300',

      // Borders (legacy tokens; most cards now use rings to avoid clipping)
      border: 'border-white/10',
      borderAccent: 'border-cyan-300/60',

      // Module surfaces
      // NOTE: prefer `moduleCard` in components; keep `moduleBg` for compatibility.
      moduleBg: 'bg-white/[0.04] backdrop-blur-xl',
      moduleHover: 'hover:bg-white/[0.06]',

      // New: consistent card styling (depth without relying on outer shadows)
      moduleCard:
        'rounded-3xl bg-gradient-to-b from-white/[0.07] via-white/[0.04] to-white/[0.02] backdrop-blur-xl ring-1 ring-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.55)] ' +
        'transition-[transform,background,box-shadow] duration-300 ease-out hover:-translate-y-[1px] hover:ring-white/20 hover:shadow-[0_18px_60px_rgba(0,0,0,0.6)]',
      moduleCardInner:
        'bg-black/20 ring-1 ring-white/10',
      moduleDivider:
        'bg-gradient-to-r from-transparent via-white/15 to-transparent',

      // Buttons - sleek, dark-first, with subtle color glow
      buttonBg: 'bg-white/5',
      buttonHover: 'hover:bg-white/8',
      buttonActive: 'active:bg-white/12',

      // Accent colors - modern cyan + violet hints (used in blobs + highlights)
      accent: 'cyan',
      accentColor: 'bg-cyan-300',

      // New: background blobs for Layout
      blobA: 'bg-fuchsia-500/50',
      blobB: 'bg-cyan-500/50',
      blobC: 'bg-violet-500/50'
    }
  }
};

export const getTheme = (themeId) => {
  return themes[themeId] || themes.dark;
};
