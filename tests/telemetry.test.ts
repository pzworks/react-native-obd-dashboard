import test from 'node:test';
import assert from 'node:assert/strict';
import { Events, Transport } from '../src/transports/types';
import { ElmSession } from '../src/obd/ElmSession';
import { Telemetry } from '../src/obd/Telemetry';
test('polls supported metrics only and stops after cancellation', async () => {
  const events = new Events(), writes: string[] = [];
  const transport: Transport = { connect: async () => {}, disconnect: async () => {}, onData: events.onData, onError: events.onError, write: async data => {
    writes.push(data);
    const reply = data.startsWith('0100') ? '410000180000>' : data.startsWith('010C') ? '410C1AF8>' : '410D64>';
    queueMicrotask(() => events.emit(reply));
  } };
  const session = new ElmSession(transport);
  let updates = 0;
  const telemetry = new Telemetry(session, () => updates++, error => { throw error; });
  assert.deepEqual(await telemetry.start(), ['rpm', 'speed']);
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.ok(updates >= 2);
  telemetry.stop();
  const count = writes.length;
  await new Promise(resolve => setTimeout(resolve, 150));
  assert.equal(writes.length, count);
  assert.ok(writes.every(command => ['0100\r', '010C\r', '010D\r'].includes(command)));
  await session.close();
});
