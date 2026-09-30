import { HomeAssistantContext } from './homeAssistantStore';
import { useHomeAssistantConnection } from '../hooks/useHomeAssistant';

export const HomeAssistantProvider = ({ children }) => {
  const value = useHomeAssistantConnection();
  return <HomeAssistantContext.Provider value={value}>{children}</HomeAssistantContext.Provider>;
};
