import test from 'node:test';
import assert from 'node:assert/strict';
import { decode, supported } from '../src/obd/protocol';
test('decodes echoed, spaced and CAN-framed responses', () => {
  assert.equal(decode('010C\rSEARCHING...\r41 0C 1A F8\r>', 'rpm'), 1726);
  assert.equal(decode('7E8 03 41 0D 64\r>', 'speed'), 100);
  assert.equal(decode('41057B', 'coolant'), 83);
});
test('rejects missing, truncated and invalid data', () => {
  for (const response of ['NO DATA', 'STOPPED', '410C1A', '410CZZFF', '410D10']) assert.equal(decode(response, 'rpm'), null);
});
test('decodes supported PID bitmap including continuation', () => {
  assert.deepEqual(supported('410000180001', 0), [12, 13, 32]);
  assert.throws(() => supported('NO DATA', 0));
});
