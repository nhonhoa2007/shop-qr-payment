'use client';

import { useRef, useState } from 'react';

interface OtpInputProps {
  onComplete: (otp: string) => void;
  disabled?: boolean;
}

export function OtpInput({ onComplete, disabled }: OtpInputProps) {
  const [values, setValues] = useState(Array(6).fill(''));
  const inputs = useRef<HTMLInputElement[]>([]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newValues = [...values];
    newValues[index] = value.slice(-1);
    setValues(newValues);

    if (value && index < 5) {
      inputs.current[index + 1]?.focus();
    }

    const otp = newValues.join('');
    if (otp.length === 6 && !otp.includes('')) onComplete(otp);
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !values[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 0) return;
    const newValues = [...values];
    pasted.split('').forEach((char, i) => {
      newValues[i] = char;
    });
    setValues(newValues);
    if (pasted.length === 6) onComplete(pasted);
    else inputs.current[pasted.length]?.focus();
  };

  return (
    <div className="flex gap-3 justify-center">
      {values.map((val, i) => (
        <input
          key={i}
          ref={(el) => { if (el) inputs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={val}
          disabled={disabled}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={i === 0 ? handlePaste : undefined}
          className="w-12 h-14 text-center text-2xl font-bold border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        />
      ))}
    </div>
  );
}
