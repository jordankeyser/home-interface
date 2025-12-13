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
      moduleBg: 'bg-white/10 backdrop-blur-md',
      moduleHover: 'hover:bg-white/15',

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

      // Module backgrounds - clean with shadow and visible border
      moduleBg: 'bg-white/95 backdrop-blur-md shadow-xl shadow-slate-400/20',
      moduleHover: 'hover:bg-slate-50',

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
      moduleBg: 'bg-amber-100/90 backdrop-blur-sm shadow-lg shadow-amber-400/20',
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
      moduleBg: 'bg-gray-100/95 backdrop-blur-sm shadow-lg shadow-gray-500/20',
      moduleHover: 'hover:bg-gray-200/70',

      // Buttons
      buttonBg: 'bg-gray-300',
      buttonHover: 'hover:bg-gray-400',
      buttonActive: 'active:bg-gray-500',

      // Accent colors
      accent: 'blue',
      accentColor: 'bg-blue-700'
    }
  }
};

export const getTheme = (themeId) => {
  return themes[themeId] || themes.dark;
};
