import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';

export function AnimatedBackground() {
  const [bubbles, setBubbles] = useState<{ id: number; size: number; left: number; duration: number; delay: number; isFire: boolean }[]>([]);

  useEffect(() => {
    const newBubbles = Array.from({ length: 25 }).map((_, i) => ({
      id: i,
      size: Math.random() * 60 + 20,
      left: Math.random() * 100,
      duration: Math.random() * 10 + 10,
      delay: Math.random() * 5,
      isFire: Math.random() > 0.6,
    }));
    setBubbles(newBubbles);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
      {/* Dynamic gradients base */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-background to-background"></div>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-accent/10 via-transparent to-transparent"></div>
      
      {/* Floating Bubbles & Fire Particles */}
      {bubbles.map((b) => (
        <motion.div
          key={b.id}
          className={`absolute bottom-[-100px] rounded-full blur-xl ${
            b.isFire 
              ? 'bg-gradient-to-tr from-orange-500/20 to-red-500/20' 
              : 'bg-gradient-to-tr from-primary/10 to-accent/10'
          }`}
          style={{
            width: b.size,
            height: b.size,
            left: `${b.left}%`,
          }}
          animate={{
            y: ['0vh', '-120vh'],
            x: ['0vw', `${Math.random() * 20 - 10}vw`],
            opacity: [0, b.isFire ? 0.6 : 0.8, 0],
            scale: b.isFire ? [1, 1.5, 0.5] : [1, 1.2, 1],
          }}
          transition={{
            duration: b.duration,
            repeat: Infinity,
            ease: "easeInOut",
            delay: b.delay,
          }}
        />
      ))}
      
      {/* Noise overlay for texture */}
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }} />
    </div>
  );
}
