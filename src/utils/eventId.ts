// Classroom deduplication IDs work on LAN HTTP as well as HTTPS.
let sequence = 0;

export function makeEventId(prefix = 'event'): string {
  sequence += 1;
  return `${prefix}-${Date.now().toString(36)}-${sequence.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
