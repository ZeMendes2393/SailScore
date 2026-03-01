'use client';

import { useCallback, useEffect, useState } from 'react';

/** Formata "045015" -> "04:50:15". Aceita string HH:MM:SS ou só dígitos. */
export function formatTimeDisplay(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '').slice(0, 6);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}:${digits.slice(2)}`;
  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}:${digits.slice(4, 6)}`;
}

/** De "04:50:15" ou "045015" extrai só os dígitos (até 6). */
export function timeToDigits(value: string): string {
  return (value || '').replace(/\D/g, '').slice(0, 6);
}

/** De dígitos "045015" produz "04:50:15" (sempre HH:MM:SS se tiver 6 dígitos). */
export function digitsToTime(digits: string): string {
  const d = digits.slice(0, 6);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}:${d.slice(2)}`;
  return `${d.slice(0, 2)}:${d.slice(2, 4)}:${d.slice(4, 6)}`;
}

interface TimeInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  /** Chamado no blur com o valor final (HH:MM:SS). Útil para commit só ao sair do campo. */
  onBlurWithValue?: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  'aria-label'?: string;
}

/**
 * Input de tempo HH:MM:SS. O utilizador pode escrever só números (ex.: 045015)
 * e o campo formata automaticamente para 04:50:15 (avança para minutos após 2 dígitos,
 * para segundos após 4).
 */
export function TimeInput({
  value,
  onChange,
  onBlur: onBlurProp,
  onBlurWithValue,
  placeholder = 'HH:MM:SS',
  className = '',
  id,
  'aria-label': ariaLabel,
}: TimeInputProps) {
  const digits = timeToDigits(value);
  const display = formatTimeDisplay(digits);

  const [local, setLocal] = useState(display);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      const d = timeToDigits(value);
      setLocal(formatTimeDisplay(d));
    }
  }, [value, focused]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      const newDigits = raw.replace(/\D/g, '').slice(0, 6);
      setLocal(formatTimeDisplay(newDigits));
      const out = digitsToTime(newDigits);
      onChange(out);
    },
    [onChange]
  );

  const handleFocus = useCallback(() => {
    setFocused(true);
    if (!local || local === '0') setLocal('');
  }, []);

  const handleBlur = useCallback(() => {
    setFocused(false);
    const d = timeToDigits(local);
    const formatted = digitsToTime(d);
    setLocal(formatTimeDisplay(d));
    onBlurWithValue?.(formatted);
    onBlurProp?.();
  }, [local, onBlurProp, onBlurWithValue]);

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9:]*"
      maxLength={8}
      value={focused ? local : formatTimeDisplay(timeToDigits(value))}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={className}
      id={id}
      aria-label={ariaLabel}
    />
  );
}
