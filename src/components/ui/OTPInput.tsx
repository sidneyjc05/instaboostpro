import React, { useState, useRef, KeyboardEvent } from 'react';
import { cn } from '../../lib/utils';

interface OTPInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function OTPInput({ length = 6, value, onChange, className }: OTPInputProps) {
  const [inputs, setInputs] = useState<string[]>(Array(length).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  React.useEffect(() => {
    // Sync external value with internal inputs array
    const newInputs = Array(length).fill('');
    for (let i = 0; i < value.length; i++) {
        if(i < length) newInputs[i] = value[i];
    }
    setInputs(newInputs);
  }, [value, length]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const text = e.target.value;
    if (!/^[0-9]*$/.test(text)) return; // Allow numbers only

    const char = text.charAt(text.length - 1); // Get last typed character
    
    // Create new array with updated value
    const newInputs = [...inputs];
    
    if (char) {
       newInputs[index] = char;
       setInputs(newInputs);
       onChange(newInputs.join(''));
       
       // Move focus to next input
       if (index < length - 1 && inputRefs.current[index + 1]) {
           inputRefs.current[index + 1]?.focus();
       }
    } else {
       // if empty (handling backspace mostly in onKeyDown, but just in case)
       newInputs[index] = '';
       setInputs(newInputs);
       onChange(newInputs.join(''));
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace') {
       if (!inputs[index] && index > 0) {
           // Move focus to previous input and clear it
           inputRefs.current[index - 1]?.focus();
           const newInputs = [...inputs];
           newInputs[index - 1] = '';
           setInputs(newInputs);
           onChange(newInputs.join(''));
       } else {
           // Clear current input
           const newInputs = [...inputs];
           newInputs[index] = '';
           setInputs(newInputs);
           onChange(newInputs.join(''));
       }
    }
    
    if (e.key === 'ArrowLeft' && index > 0) {
        inputRefs.current[index - 1]?.focus();
    }
    
    if (e.key === 'ArrowRight' && index < length - 1) {
        inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, length).replace(/[^0-9]/g, '');
    const newInputs = [...inputs];
    for (let i = 0; i < pastedData.length; i++) {
        newInputs[i] = pastedData[i];
    }
    setInputs(newInputs);
    onChange(newInputs.join(''));
    
    // Focus last filled input
    const focusIndex = Math.min(pastedData.length, length - 1);
    inputRefs.current[focusIndex]?.focus();
  };

  return (
    <div className={cn("flex justify-center gap-2", className)} onPaste={handlePaste}>
      {inputs.map((val, index) => (
        <input
          key={index}
          ref={(el) => inputRefs.current[index] = el}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={val}
          onChange={(e) => handleChange(e, index)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          className="w-12 h-14 md:w-14 md:h-16 text-center text-2xl font-mono font-bold border-2 border-border rounded-xl focus:border-primary focus:ring-4 focus:ring-primary/20 outline-none transition-all bg-card text-foreground"
        />
      ))}
    </div>
  );
}
