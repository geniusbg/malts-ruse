function pad2(n: number) {
  return String(n).padStart(2, '0');
}

/**
 * Convert ISO date/time string to a `datetime-local` value in the user's local timezone.
 * Example output: "2026-04-13T18:30"
 */
export function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(
    d.getMinutes()
  )}`;
}

