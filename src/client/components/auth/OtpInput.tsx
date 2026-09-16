'use client';

import { useRef, useState, useEffect } from 'react';

interface OtpInputProps {
  onComplete: (otp: string) => void;
  onChange?: (otp: string) => void;
  disabled?: boolean;
}

export function OtpInput({ onComplete, onChange, disabled }: OtpInputProps) {
  const [values, setValues] = useState<string[]>(Array(6).fill(''));
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Focus first empty box on load
    inputs.current[0]?.focus();
  }, []);

  const triggerChange = (newVals: string[]) => {
    const fullOtp = newVals.join('');
    if (onChange) onChange(fullOtp);
    if (fullOtp.length === 6 && !newVals.includes('')) {
      onComplete(fullOtp);
    }
  };

  const handleChange = (index: number, rawValue: string) => {
    // Extract only digits
    const digits = rawValue.replace(/\D/g, '');
    if (!digits) {
      const newValues = [...values];
      newValues[index] = '';
      setValues(newValues);
      triggerChange(newValues);
      return;
    }

    const newValues = [...values];

    if (digits.length > 1) {
      // User pasted or autofilled multiple digits into this input
      const chars = digits.slice(0, 6).split('');
      chars.forEach((char, i) => {
        if (index + i < 6) {
          newValues[index + i] = char;
        }
      });
      setValues(newValues);

      const nextFocus = Math.min(index + chars.length, 5);
      inputs.current[nextFocus]?.focus();
      triggerChange(newValues);
      return;
    }

    // Single digit input
    newValues[index] = digits.slice(-1);
    setValues(newValues);

    if (index < 5) {
      inputs.current[index + 1]?.focus();
    }

    triggerChange(newValues);
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!values[index] && index > 0) {
        inputs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const newValues = [...values];
    pasted.split('').forEach((char, i) => {
      newValues[i] = char;
    });
    setValues(newValues);

    const nextIndex = Math.min(pasted.length, 5);
    inputs.current[nextIndex]?.focus();

    if (pasted.length === 6) {
      onComplete(pasted);
    }
  };

  return (
    <div className="flex gap-2 sm:gap-3 justify-center">
      {values.map((val, i) => (
        <input
          key={i}
          ref={(el) => {
            inputs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          value={val}
          disabled={disabled}
          autoComplete="one-time-code"
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          className="w-11 h-14 sm:w-12 sm:h-16 text-center text-2xl font-semibold border border-[#ebebeb] bg-white rounded-2xl focus:border-[#5433eb] focus:ring-4 focus:ring-[#c0b5f3]/40 outline-none transition-all shadow-[0_2px_8px_rgba(0,0,0,0.04)] disabled:opacity-50 disabled:cursor-not-allowed"
        />
      ))}
    </div>
  );
}
