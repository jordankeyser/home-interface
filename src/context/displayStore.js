import { createContext } from 'react';

/**
 * Display/sleep state. Data hooks read `isAsleep` from here so they can stop
 * polling while the backlight is off instead of hammering APIs at an unlit
 * screen.
 */
export const DisplayContext = createContext({
  isAsleep: false,
  sleep: () => {},
  wake: () => {},
});
