import { cn } from '../../lib/utils';
import React from 'react';
import { Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useAppSound } from '../../context/SoundContext';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, children, onClick, ...props }, ref) => {
    const { soundEnabled, playClick } = useAppSound();

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (soundEnabled && !isLoading && !props.disabled) {
         playClick();
      }
      onClick?.(e);
    };

    const variants = {
      primary: 'bg-primary text-primary-foreground hover:opacity-90 shadow-sm',
      secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
      outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
      ghost: 'hover:bg-accent hover:text-accent-foreground',
      destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
    };

    const sizes = {
      sm: 'h-9 px-3 text-sm',
      md: 'h-11 px-4 py-2',
      lg: 'h-14 px-8 text-lg',
    };

    return (
      <motion.button
        whileTap={{ scale: 0.98 }}
        ref={ref}
        onClick={handleClick}
        disabled={isLoading || props.disabled}
        className={cn(
          'inline-flex items-center justify-center rounded-xl font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 relative overflow-hidden',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {children}
      </motion.button>
    );
  }
);
Button.displayName = 'Button';
