export interface Transport {
  connect(): Promise<void>;
  write(data: string): Promise<void>;
  onData(listener: (data: string) => void): () => void;
  onError(listener: (error: Error) => void): () => void;
  disconnect(): Promise<void>;
}
export type Connection =
  | { kind: 'classic'; address: string }
  | { kind: 'ble'; address: string; service: string; tx: string; rx: string }
  | { kind: 'wifi'; host: string; port: number };
export class Events {
  private data = new Set<(data: string) => void>();
  private errors = new Set<(error: Error) => void>();
  onData = (fn: (data: string) => void) => { this.data.add(fn); return () => { this.data.delete(fn); }; };
  onError = (fn: (error: Error) => void) => { this.errors.add(fn); return () => { this.errors.delete(fn); }; };
  emit = (data: string) => this.data.forEach(fn => fn(data));
  fail = (error: Error) => this.errors.forEach(fn => fn(error));
}
