import { createContext } from 'react';

/**
 * One Home Assistant connection for the whole panel. The devices page and the
 * lights shortcut on the home page both read it, so neither opens its own
 * WebSocket. Provided by `HomeAssistantProvider`.
 */
export const HomeAssistantContext = createContext(null);
