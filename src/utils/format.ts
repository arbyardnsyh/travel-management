// =============================================================================
// Formatting utilities — moved out of `src/lib/helpers.ts` (Enhancement Batch).
// Re-exported from `src/lib/helpers.ts` for backward compatibility.
// =============================================================================

/** Formats a number as Indonesian Rupiah currency, e.g. Rp 1.500.000. */
export function formatCurrency(value: number | string | null | undefined): string {
  const num = Number(value ?? 0);
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(num);
}

/** Formats an ISO date/timestamp string into a readable Indonesian date. */
export function formatDate(value: string | null | undefined, withTime = false): string {
  if (!value) return '-';
  const date = new Date(value);
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date);
}

/** Truncates plain text (e.g. blog excerpts) to a max character length. */
export function excerpt(text: string | null | undefined, length = 160): string {
  if (!text) return '';
  const plain = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return plain.length > length ? `${plain.slice(0, length).trim()}…` : plain;
}
