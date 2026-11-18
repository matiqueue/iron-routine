import React, { createContext, useContext } from 'react';

const TabActivityContext = createContext<boolean>(true);

export const TabActivityProvider: React.FC<{
  active: boolean;
  children: React.ReactNode;
}> = ({ active, children }) => (
  <TabActivityContext.Provider value={active}>{children}</TabActivityContext.Provider>
);

/**
 * Returns true only when this subtree's tab/screen is visibly active
 * and the app is in the foreground. Used to pause ambient loops off-screen.
 */
export function useIsScreenActive(): boolean {
  return useContext(TabActivityContext);
}
