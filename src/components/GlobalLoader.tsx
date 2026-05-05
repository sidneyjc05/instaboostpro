import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface GlobalLoaderProps {
  isLoading: boolean;
}

export function GlobalLoader({ isLoading }: GlobalLoaderProps) {
  const [show, setShow] = useState(isLoading);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isLoading) {
      setShow(true);
    } else {
      // Prevenir flickering rápido quando já carregou
      timer = setTimeout(() => setShow(false), 300);
    }
    return () => clearTimeout(timer);
  }, [isLoading]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background"
        >
          <div className="relative flex flex-col items-center justify-center">
            {/* Efeito de brilho de fundo */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary/20 blur-[80px] rounded-full w-48 h-48 animate-pulse" />
            
            {/* Ícone principal roxo (primary) */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
              className="relative z-10"
            >
              <Loader2 className="text-primary w-16 h-16 drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]" />
            </motion.div>
            
            {/* Texto amigável */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-8 flex flex-col items-center gap-2"
            >
              <h2 className="text-foreground font-bold tracking-widest uppercase text-sm drop-shadow-sm">
                Carregando
              </h2>
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ y: [0, -5, 0], opacity: [0.3, 1, 0.3] }}
                    transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
                    className="w-2 h-2 rounded-full bg-primary"
                  />
                ))}
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
