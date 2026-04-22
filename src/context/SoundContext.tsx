import React, { createContext, useContext, useState } from 'react';

interface SoundContextType {
  soundEnabled: boolean;
  toggleSound: () => void;
  playSuccess: () => void;
  playClick: () => void;
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

  const playSuccess = () => {
    if (!soundEnabled) return;
    try {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3');
      audio.volume = 0.5;
      audio.play().catch(() => {});
    } catch {}
  };

  const playClick = () => {
    if (!soundEnabled) return;
    try {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3');
      audio.volume = 0.3;
      audio.play().catch(() => {});
    } catch {}
  };

  return (
    <SoundContext.Provider value={{ soundEnabled, toggleSound, playSuccess, playClick }}>
      {children}
    </SoundContext.Provider>
  );
}

export const useAppSound = () => {
  const ctx = useContext(SoundContext);
  if (!ctx) throw new Error('useAppSound must be used within a SoundProvider');
  return ctx;
};
