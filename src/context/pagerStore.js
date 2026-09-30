import { createContext } from 'react';

/** Lets anything inside the Pager jump to a page, e.g. a shortcut button. */
export const PagerContext = createContext({ index: 0, goTo: () => {} });
