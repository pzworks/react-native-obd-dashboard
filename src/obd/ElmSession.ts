import type { Transport } from '../transports/types';
export class ElmSession {
  private tail: Promise<unknown> = Promise.resolve();
  private pending?: { resolve: (data: string) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> };
  private buffer = '';
  private closed = false;
  private poisoned = false;
  private off: (() => void)[];
  constructor(private transport: Transport) {
    this.off = [transport.onData(this.receive), transport.onError(error => this.abort(error))];
  }
  private receive = (data: string) => {
    if (!this.pending) return;
    this.buffer += data;
    if (this.buffer.length > 65536) { this.abort(new Error('Odpowiedź ELM przekroczyła limit')); return; }
    const end = this.buffer.indexOf('>');
    if (end < 0) return;
    const pending = this.pending;
    this.pending = undefined;
    clearTimeout(pending.timer);
    pending.resolve(this.buffer.slice(0, end));
    this.buffer = '';
  };
  private abort(error: Error) {
    this.poisoned = true;
    if (this.pending) { clearTimeout(this.pending.timer); this.pending.reject(error); this.pending = undefined; }
    this.buffer = '';
  }
  command(command: string, timeout = 3000): Promise<string> {
    const result = this.tail.then(() => {
      if (this.closed || this.poisoned) throw new Error('Sesja zamknięta; połącz adapter ponownie');
      return new Promise<string>((resolve, reject) => {
        this.buffer = '';
        const timer = setTimeout(() => this.abort(new Error(`Timeout: ${command}`)), timeout);
        this.pending = { resolve, reject, timer };
        this.transport.write(command + '\r').catch(error => this.abort(error));
      });
    });
    this.tail = result.catch(() => undefined);
    return result;
  }
  async initialize() {
    await this.command('ATZ', 5000);
    for (const command of ['ATE0', 'ATL0', 'ATS0', 'ATH0', 'ATSP0']) {
      const result = await this.command(command);
      if (!/\bOK\b/i.test(result)) throw new Error(`Adapter odrzucił ${command}: ${result.trim()}`);
    }
  }
  async close() {
    this.closed = true;
    this.abort(new Error('Rozłączono'));
    this.off.forEach(fn => fn());
    await this.transport.disconnect();
  }
}
