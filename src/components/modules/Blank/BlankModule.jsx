import React from 'react';
import { useSettings } from '../../../context/SettingsContext';

const BlankModule = () => {
  const { currentTheme } = useSettings();
  const theme = currentTheme.colors;
  const moduleCard = theme.moduleCard || `${theme.moduleBg} ${theme.border} border shadow-xl rounded-3xl`;

  // Intentionally blank placeholder for future content.
  return <div className={`w-full h-full ${moduleCard}`} aria-label="Empty module placeholder" />;
};

export default BlankModule;


