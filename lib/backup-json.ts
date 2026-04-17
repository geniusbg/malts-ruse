/** Serialize Prisma rows with BigInt for JSON APIs. */
export function normalizeBackupJson<T>(payload: T): T {
  return JSON.parse(JSON.stringify(payload, (_key, value) => (typeof value === 'bigint' ? value.toString() : value)));
}
