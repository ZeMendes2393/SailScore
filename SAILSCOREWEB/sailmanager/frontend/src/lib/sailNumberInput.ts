/** Keep only digits for sail number fields (country code is separate). */
export function sanitizeSailNumberInput(value: string): string {
  return (value || '').replace(/\D/g, '');
}
