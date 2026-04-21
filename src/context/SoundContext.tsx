import React, { createContext, useContext, useState } from 'react';

interface SoundContextType {
  soundEnabled: boolean;
  toggleSound: () => void;
}

const SoundContext = createContext<SoundContextType | undefined>(undefined);

export function SoundProvider({ children }: { children: React.ReactNode }) {
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem('sound') !== 'false';
  });

  const toggleSound = () => {
    setSoundEnabled(prev => {
      localStorage.setItem('sound', String(!prev));
      return !prev;
    });
  };

  return (
    <SoundContext.Provider value={{ soundEnabled, toggleSound }}>
      {children}
    </SoundContext.Provider>
  );
}

export const useAppSound = () => {
  const ctx = useContext(SoundContext);
  if (!ctx) throw new Error('useAppSound must be used within a SoundProvider');
  return ctx;
};
