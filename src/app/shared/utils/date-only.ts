/** Extrae YYYY-MM-DD sin corrimiento por zona horaria. */
export function toDateInputValue(value?: string | Date | null): string {
  if (value == null || value === '') return '';
  const raw = typeof value === 'string' ? value : value.toISOString();
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
}

/** Texto legible del cumpleaños (día civil UTC = día elegido en el input). */
export function formatDateOnlyLong(value?: string | Date | null): string {
  const iso = toDateInputValue(value);
  if (!iso) return '';

  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function esCumpleanosHoy(value?: string | Date | null): boolean {
  const iso = toDateInputValue(value);
  if (!iso) return false;

  const [, m, d] = iso.split('-').map(Number);
  const hoy = new Date();
  return m === hoy.getMonth() + 1 && d === hoy.getDate();
}
