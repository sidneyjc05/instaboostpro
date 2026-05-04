import React from 'react';
import { motion } from 'motion/react';
import { Coins, Ticket, Diamond, Flame, Droplets, Sparkles, Trophy } from 'lucide-react';

export type IconType = 'coin' | 'ticket' | 'diamond' | 'fire' | 'water' | 'sparkle' | 'trophy';

interface Props {
  type: IconType;
  className?: string;
  size?: number;
}

export function AnimatedIcon({ type, className = '', size = 20 }: Props) {
  switch (type) {
    case 'coin':
      return (
        <motion.span
           animate={{ rotateY: [0, 180, 360] }}
           transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
           className={`inline-flex items-center justify-center text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)] ${className}`}
        >
          <Coins size={size} strokeWidth={2.5} />
        </motion.span>
      );
    case 'ticket':
      return (
        <motion.span
           animate={{ rotate: [-5, 5, -5], scale: [1, 1.1, 1] }}
           transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
           className={`inline-flex items-center justify-center text-purple-400 drop-shadow-[0_0_8px_rgba(192,132,252,0.5)] ${className}`}
        >
          <Ticket size={size} strokeWidth={2.5} />
        </motion.span>
      );
    case 'diamond':
      return (
        <motion.span
           animate={{ y: [-2, 2, -2], filter: ['brightness(1)', 'brightness(1.5)', 'brightness(1)'] }}
           transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
           className={`inline-flex items-center justify-center text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.6)] ${className}`}
        >
          <Diamond size={size} strokeWidth={2.5} />
        </motion.span>
      );
    case 'fire':
       return (
         <motion.span
           animate={{ scale: [1, 1.1, 1], filter: ['hue-rotate(0deg)', 'hue-rotate(-15deg)', 'hue-rotate(0deg)'] }}
           transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
           className={`inline-flex items-center justify-center text-orange-500 drop-shadow-[0_0_12px_rgba(249,115,22,0.8)] ${className}`}
         >
           <Flame size={size} strokeWidth={2.5} fill="currentColor" fillOpacity={0.4} />
         </motion.span>
       );
    case 'water':
       return (
         <motion.span
           animate={{ y: [0, -5, 0], scale: [1, 1.05, 1] }}
           transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
           className={`inline-flex items-center justify-center text-blue-400 drop-shadow-[0_0_12px_rgba(96,165,250,0.6)] ${className}`}
         >
           <Droplets size={size} strokeWidth={2.5} fill="currentColor" fillOpacity={0.4} />
         </motion.span>
       );
    case 'sparkle':
       return (
         <motion.span
           animate={{ scale: [1, 1.3, 1], rotate: [0, 90] }}
           transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
           className={`inline-flex items-center justify-center text-yellow-300 drop-shadow-[0_0_12px_rgba(253,224,71,0.8)] ${className}`}
         >
           <Sparkles size={size} strokeWidth={2.5} />
         </motion.span>
       );
    case 'trophy':
       return (
         <motion.span
           animate={{ scale: [1, 1.1, 1], rotate: [-5, 5, -5] }}
           transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
           className={`inline-flex items-center justify-center text-amber-500 drop-shadow-[0_0_12px_rgba(245,158,11,0.6)] ${className}`}
         >
           <Trophy size={size} strokeWidth={2.5} />
         </motion.span>
       );
    default:
      return null;
  }
}
