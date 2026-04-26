'use client';

import { useCallback, useEffect, useState } from 'react';

/** Formata dígitos para tempo, suportando hora com 2 ou 3 dígitos. */
export function formatTimeDisplay(raw: string, hourDigits = 2): string {
  const safeHourDigits = Math.max(1, Math.floor(hourDigits));
  const maxDigits = safeHourDigits + 4;
  const digits = (raw || '').replace(/\D/g, '').slice(0, maxDigits);
  if (digits.length <= safeHourDigits) return digits;
  if (digits.length <= safeHourDigits + 2) {
    return `${digits.slice(0, safeHourDigits)}:${digits.slice(safeHourDigits)}`;
  }
  return `${digits.slice(0, safeHourDigits)}:${digits.slice(safeHourDigits, safeHourDigits + 2)}:${digits.slice(safeHourDigits + 2, safeHourDigits + 4)}`;
}

/** Extrai só os dígitos (até hora+MM+SS). */
export function timeToDigits(value: string, hourDigits = 2): string {
  const safeHourDigits = Math.max(1, Math.floor(hourDigits));
  const maxDigits = safeHourDigits + 4;
  return (value || '').replace(/\D/g, '').slice(0, maxDigits);
}

/** De dígitos produz tempo no formato H..H:MM:SS (parcial enquanto digita). */
export function digitsToTime(digits: string, hourDigits = 2): string {
  const safeHourDigits = Math.max(1, Math.floor(hourDigits));
  const maxDigits = safeHourDigits + 4;
  const d = digits.slice(0, maxDigits);
  if (d.length <= safeHourDigits) return d;
  if (d.length <= safeHourDigits + 2) {
    return `${d.slice(0, safeHourDigits)}:${d.slice(safeHourDigits)}`;
  }
  return `${d.slice(0, safeHourDigits)}:${d.slice(safeHourDigits, safeHourDigits + 2)}:${d.slice(safeHourDigits + 2, safeHourDigits + 4)}`;
}

interface TimeInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  /** Chamado no blur com o valor final (HH:MM:SS). Útil para commit só ao sair do campo. */
  onBlurWithValue?: (value: string) => void;
  placeholder?: string;
  /** 2 para HH:MM:SS (default), 3 para HHH:MM:SS. */
  hourDigits?: number;
  className?: string;
  id?: string;
  'aria-label'?: string;
}

/**
 * Input de tempo HH:MM:SS (ou HHH:MM:SS com hourDigits=3).
 * O utilizador pode escrever só números e o campo formata automaticamente.
 */
export function TimeInput({
  value,
  onChange,
  onBlur: onBlurProp,
  onBlurWithValue,
  placeholder,
  hourDigits = 2,
  className = '',
  id,
  'aria-label': ariaLabel,
}: TimeInputProps) {
  const finalPlaceholder = placeholder ?? (hourDigits === 3 ? 'HHH:MM:SS' : 'HH:MM:SS');
  const digits = timeToDigits(value, hourDigits);
  const display = formatTimeDisplay(digits, hourDigits);

  const [local, setLocal] = useState(display);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      const d = timeToDigits(value, hourDigits);
      setLocal(formatTimeDisplay(d, hourDigits));
    }
  }, [value, focused, hourDigits]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      const newDigits = timeToDigits(raw, hourDigits);
      setLocal(formatTimeDisplay(newDigits, hourDigits));
      const out = digitsToTime(newDigits, hourDigits);
      onChange(out);
    },
    [onChange, hourDigits]
  );

  const handleFocus = useCallback(() => {
    setFocused(true);
    if (!local || local === '0') setLocal('');
  }, []);

  const handleBlur = useCallback(() => {
    setFocused(false);
    const d = timeToDigits(local, hourDigits);
    const formatted = digitsToTime(d, hourDigits);
    setLocal(formatTimeDisplay(d, hourDigits));
    onBlurWithValue?.(formatted);
    onBlurProp?.();
  }, [local, onBlurProp, onBlurWithValue, hourDigits]);

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9:]*"
      maxLength={hourDigits + 6}
      value={focused ? local : formatTimeDisplay(timeToDigits(value, hourDigits), hourDigits)}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={finalPlaceholder}
      className={className}
      id={id}
      aria-label={ariaLabel}
    />
  );
}
