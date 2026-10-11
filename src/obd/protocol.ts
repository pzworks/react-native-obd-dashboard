export const pids = {
  rpm: { pid: 0x0c, bytes: 2, unit: 'rpm', decode: (a: number, b: number) => (a * 256 + b) / 4 },
  speed: { pid: 0x0d, bytes: 1, unit: 'km/h', decode: (a: number) => a },
  coolant: { pid: 0x05, bytes: 1, unit: '°C', decode: (a: number) => a - 40 },
  intake: { pid: 0x0f, bytes: 1, unit: '°C', decode: (a: number) => a - 40 },
  load: { pid: 0x04, bytes: 1, unit: '%', decode: (a: number) => a * 100 / 255 },
  map: { pid: 0x0b, bytes: 1, unit: 'kPa abs', decode: (a: number) => a },
} as const;
export type Metric = keyof typeof pids;
export type Reading = { value: number; at: number };
export type Readings = Partial<Record<Metric, Reading>>;
export const hex = (value: number) => value.toString(16).padStart(2, '0').toUpperCase();
export function payload(raw: string, pid: number): number[] | null {
  for (const line of raw.replace(/>/g, '').split(/[\r\n]+/)) {
    const compact = line.replace(/\s/g, '').toUpperCase();
    if (!/^[0-9A-F]+$/.test(compact)) continue;
    const marker = '41' + hex(pid);
    const start = compact.indexOf(marker);
    if (start < 0) continue;
    const rest = compact.slice(start + marker.length);
    if (rest.length % 2) continue;
    return rest.match(/../g)?.map(byte => parseInt(byte, 16)) ?? [];
  }
  return null;
}
export function decode(raw: string, key: Metric): number | null {
  const spec = pids[key];
  const bytes = payload(raw, spec.pid);
  if (!bytes || bytes.length < spec.bytes) return null;
  return spec.decode(bytes[0], bytes[1]);
}
export function supported(raw: string, base: number): number[] {
  const bytes = payload(raw, base);
  if (!bytes || bytes.length < 4) throw new Error('ECU nie zwróciło listy wspieranych PID-ów');
  const result: number[] = [];
  for (let bit = 0; bit < 32; bit++) if (bytes[Math.floor(bit / 8)] & (1 << (7 - bit % 8))) result.push(base + bit + 1);
  return result;
}
