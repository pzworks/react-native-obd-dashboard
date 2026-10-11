import test from 'node:test';
import assert from 'node:assert/strict';
import { ElmSession } from '../src/obd/ElmSession';
import { Events, Transport } from '../src/transports/types';
function fake() {
  const events = new Events(), writes: string[] = [];
  const transport: Transport = { connect: async () => {}, write: async data => { writes.push(data); }, onData: events.onData, onError: events.onError, disconnect: async () => {} };
  return { events, writes, session: new ElmSession(transport) };
}
test('serializes requests and reassembles fragmented prompts', async () => {
  const { session, events, writes } = fake();
  const one = session.command('010C'), two = session.command('010D');
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(writes, ['010C\r']);
  events.emit('41 0C '); events.emit('1A F8\r>');
  assert.equal(await one, '41 0C 1A F8\r');
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(writes, ['010C\r', '010D\r']);
  events.emit('410D64>'); assert.equal(await two, '410D64'); await session.close();
});
test('timeout poisons session so late data cannot satisfy another request', async () => {
  const { session, events, writes } = fake();
  await assert.rejects(session.command('010C', 10), /Timeout/);
  events.emit('410CFFFF>');
  await assert.rejects(session.command('010D'), /Sesja zamknięta/);
  assert.equal(writes.length, 1); await session.close();
});
test('disconnect rejects an in-flight command and stops queued writes', async () => {
  const { session, writes } = fake();
  const pending = session.command('010C');
  const check = assert.rejects(pending, /Rozłączono/);
  await new Promise(resolve => setImmediate(resolve));
  await session.close(); await check;
  await assert.rejects(session.command('010D')); assert.equal(writes.length, 1);
});
test('transport error immediately rejects pending request', async () => {
  const { session, events } = fake();
  const pending = session.command('010C'); const check = assert.rejects(pending, /link lost/);
  await new Promise(resolve => setImmediate(resolve)); events.fail(new Error('link lost')); await check; await session.close();
});
