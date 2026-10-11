import { ElmSession } from './ElmSession';
import { decode, hex, Metric, pids, Readings, supported } from './protocol';
export class Telemetry {
  private stopped = false;
  private timer?: ReturnType<typeof setTimeout>;
  private tick = 0;
  private available: Metric[] = [];
  private readings: Readings = {};
  constructor(private session: ElmSession, private update: (readings: Readings) => void, private fail: (error: Error) => void) {}
  async start() {
    const ids = supported(await this.session.command('0100', 15000), 0);
    this.available = (Object.keys(pids) as Metric[]).filter(key => ids.includes(pids[key].pid));
    if (!this.available.length) throw new Error('Brak obsługiwanych parametrów dashboardu');
    if (!this.stopped) void this.poll();
    return this.available;
  }
  private async poll() {
    try {
      const selected = this.available.filter(key => key === 'rpm' || key === 'speed' || this.tick % 5 === 0);
      for (const key of selected) {
        if (this.stopped) return;
        const value = decode(await this.session.command('01' + hex(pids[key].pid)), key);
        if (this.stopped) return;
        if (value !== null) this.readings[key] = { value, at: Date.now() };
        else delete this.readings[key];
        this.update({ ...this.readings });
      }
      this.tick++;
      if (!this.stopped) this.timer = setTimeout(() => void this.poll(), 100);
    } catch (error) { if (!this.stopped) { this.stop(); this.fail(error as Error); } }
  }
  stop() { this.stopped = true; clearTimeout(this.timer); }
}
