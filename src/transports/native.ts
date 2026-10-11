import { PermissionsAndroid, Platform } from 'react-native';
import { Buffer } from 'buffer';
import { Connection, Events, Transport } from './types';
import type { BleManager } from 'react-native-ble-plx';
async function poweredOn(manager: BleManager) {
  if (await manager.state() === 'PoweredOn') return;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => { subscription.remove(); reject(new Error('Włącz Bluetooth i spróbuj ponownie')); }, 5000);
    const subscription = manager.onStateChange(state => { if (state === 'PoweredOn') { clearTimeout(timer); subscription.remove(); resolve(); } }, false);
  });
}
export async function permissions(kind: Connection['kind']) {
  if (Platform.OS !== 'android' || kind === 'wifi') return;
  const required = Number(Platform.Version) >= 31
    ? [PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT, PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN]
    : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
  const result = await PermissionsAndroid.requestMultiple(required);
  if (required.some(name => result[name] !== PermissionsAndroid.RESULTS.GRANTED)) throw new Error('Brak uprawnień Bluetooth');
}
export async function pairedDevices() {
  await permissions('classic');
  const { default: classic } = await import('react-native-bluetooth-classic');
  return classic.getBondedDevices();
}
export async function scanBle(onDevice: (id: string, name: string) => void): Promise<() => void> {
  await permissions('ble');
  const { BleManager } = await import('react-native-ble-plx');
  const manager = new BleManager();
  try { await poweredOn(manager); } catch (error) { manager.destroy(); throw error; }
  const timer = setTimeout(() => { manager.stopDeviceScan(); manager.destroy(); }, 10000);
  manager.startDeviceScan(null, null, (error, device) => {
    if (error) { clearTimeout(timer); manager.stopDeviceScan(); manager.destroy(); return; }
    if (device) onDevice(device.id, device.name ?? device.localName ?? 'BLE adapter');
  });
  return () => { clearTimeout(timer); manager.stopDeviceScan(); manager.destroy(); };
}
export async function createTransport(config: Connection): Promise<Transport> {
  await permissions(config.kind);
  const events = new Events();
  if (config.kind === 'classic') {
    const { default: classic } = await import('react-native-bluetooth-classic');
    let device: Awaited<ReturnType<typeof classic.connectToDevice>> | undefined;
    let subscriptions: { remove(): void }[] = [];
    let intentional = false;
    return {
      onData: events.onData, onError: events.onError,
      async connect() {
        device = await classic.connectToDevice(config.address, { connectorType: 'rfcomm', connectionType: 'delimited', delimiter: '', charset: 'US-ASCII' });
        subscriptions = [device.onDataReceived(event => events.emit(event.data)), classic.onDeviceDisconnected(event => {
          if (!intentional && event.device.address === config.address) events.fail(new Error('Bluetooth rozłączony'));
        })];
      },
      async write(data) { if (!device || !(await device.write(data))) throw new Error('Zapis Bluetooth nieudany'); },
      async disconnect() { intentional = true; subscriptions.forEach(sub => sub.remove()); if (device) await device.disconnect(); },
    };
  }
  if (config.kind === 'ble') {
    const { BleManager } = await import('react-native-ble-plx');
    const manager = new BleManager();
    let device: Awaited<ReturnType<typeof manager.connectToDevice>> | undefined;
    let subscriptions: { remove(): void }[] = [];
    let withResponse = true;
    let intentional = false;
    return {
      onData: events.onData, onError: events.onError,
      async connect() {
        await poweredOn(manager);
        device = await manager.connectToDevice(config.address, { timeout: 10000 });
        await device.discoverAllServicesAndCharacteristics();
        const chars = await device.characteristicsForService(config.service);
        const tx = chars.find(char => char.uuid.toLowerCase() === config.tx.toLowerCase());
        const rx = chars.find(char => char.uuid.toLowerCase() === config.rx.toLowerCase());
        if (!tx || (!tx.isWritableWithResponse && !tx.isWritableWithoutResponse) || !rx || (!rx.isNotifiable && !rx.isIndicatable)) throw new Error('Nieprawidłowy profil BLE: sprawdź UUID');
        withResponse = tx.isWritableWithResponse;
        subscriptions = [device.monitorCharacteristicForService(config.service, config.rx, (error, char) => {
          if (error && !intentional) events.fail(new Error(error.message));
          if (char?.value) events.emit(Buffer.from(char.value, 'base64').toString('ascii'));
        }), device.onDisconnected(() => { if (!intentional) events.fail(new Error('BLE rozłączone')); })];
      },
      async write(data) {
        if (!device) throw new Error('BLE niepołączone');
        for (let offset = 0; offset < data.length; offset += 20) {
          const value = Buffer.from(data.slice(offset, offset + 20), 'ascii').toString('base64');
          if (withResponse) await device.writeCharacteristicWithResponseForService(config.service, config.tx, value);
          else await device.writeCharacteristicWithoutResponseForService(config.service, config.tx, value);
        }
      },
      async disconnect() {
        intentional = true;
        subscriptions.forEach(sub => sub.remove());
        try { if (device) await manager.cancelDeviceConnection(device.id); } finally { manager.destroy(); }
      },
    };
  }
  const { default: tcp } = await import('react-native-tcp-socket');
  let socket: ReturnType<typeof tcp.createConnection> | undefined;
  let intentional = false;
  return {
    onData: events.onData, onError: events.onError,
    connect: () => new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { socket?.destroy(); reject(new Error('Timeout Wi-Fi')); }, 10000);
      socket = tcp.createConnection({ host: config.host, port: config.port, interface: 'wifi', connectTimeout: 10000 }, () => { clearTimeout(timer); resolve(); });
      socket.on('data', data => events.emit(typeof data === 'string' ? data : data.toString('ascii')));
      socket.on('error', error => { clearTimeout(timer); reject(error); if (!intentional) events.fail(error); });
      socket.on('close', () => { clearTimeout(timer); reject(new Error('Wi-Fi rozłączone')); if (!intentional) events.fail(new Error('Wi-Fi rozłączone')); });
    }),
    async write(data) { if (!socket) throw new Error('Wi-Fi niepołączone'); socket.write(data); },
    async disconnect() { intentional = true; socket?.destroy(); },
  };
}
