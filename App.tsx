import React, { useEffect, useRef, useState } from 'react';
import { SafeAreaView, ScrollView, View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useKeepAwake } from 'expo-keep-awake';
import { Gauge } from './src/components/Gauge';
import { Connection } from './src/transports/types';
import { pairedDevices, scanBle } from './src/transports/native';
import { pids, Metric } from './src/obd/protocol';
import { useDashboard } from './src/useDashboard';
const initial = { address: '', host: '192.168.0.10', port: '35000', service: '0000fff0-0000-1000-8000-00805f9b34fb', tx: '0000fff2-0000-1000-8000-00805f9b34fb', rx: '0000fff1-0000-1000-8000-00805f9b34fb' };
function Awake() { useKeepAwake(); return null; }
export default function App() {
  const dashboard = useDashboard();
  const [kind, setKind] = useState<Connection['kind']>('classic');
  const [form, setForm] = useState(initial);
  const [settings, setSettings] = useState(true);
  const [error, setError] = useState('');
  const [devices, setDevices] = useState<{ id: string; name: string }[]>([]);
  const [now, setNow] = useState(Date.now());
  const scanStop = useRef<(() => void) | undefined>(undefined);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    AsyncStorage.getItem('adapter').then(saved => { if (saved) { try { const config = JSON.parse(saved); if (['classic', 'ble', 'wifi'].includes(config.kind)) setKind(config.kind); setForm({ ...initial, ...config.form }); } catch {} } }).catch(() => {});
    return () => { clearInterval(timer); scanStop.current?.(); };
  }, []);
  const value = (key: Metric) => { const reading = dashboard.readings[key]; return reading && now - reading.at < 5000 ? reading.value : undefined; };
  const connect = async () => {
    setError(''); scanStop.current?.();
    const port = Number(form.port);
    if (kind === 'wifi' && (!form.host.trim() || !Number.isInteger(port) || port < 1 || port > 65535)) { setError('Sprawdź adres IP i port'); return; }
    if (kind !== 'wifi' && !form.address.trim()) { setError('Wybierz adapter lub wpisz adres'); return; }
    if (kind === 'ble' && [form.service, form.tx, form.rx].some(uuid => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid))) { setError('UUID musi mieć pełny format 128-bit'); return; }
    const config: Connection = kind === 'wifi' ? { kind, host: form.host.trim(), port } : kind === 'classic' ? { kind, address: form.address.trim() } : { kind, address: form.address.trim(), service: form.service, tx: form.tx, rx: form.rx };
    try { await AsyncStorage.setItem('adapter', JSON.stringify({ kind, form })); setSettings(false); await dashboard.connect(config); } catch (err) { setError((err as Error).message); }
  };
  const discover = async () => {
    setDevices([]); setError(''); scanStop.current?.();
    try {
      if (kind === 'classic') setDevices((await pairedDevices()).map(device => ({ id: device.address, name: device.name })));
      else scanStop.current = await scanBle((id, name) => setDevices(previous => previous.some(device => device.id === id) ? previous : [...previous, { id, name }]));
    } catch (err) { setError((err as Error).message); }
  };
  const button = (label: string, action: () => void, selected = false) => <TouchableOpacity accessibilityRole="button" style={[styles.button, selected && styles.selected]} onPress={action}><Text style={styles.amber}>{label}</Text></TouchableOpacity>;
  return <SafeAreaView style={styles.root}>
    {dashboard.active && <Awake />}
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.row}><Text style={styles.title}>RETRO / OBD</Text><Text style={styles.status}>{dashboard.status}</Text></View>
      <View style={styles.row}>{button('Adapter', () => setSettings(!settings))}{button('Demo', () => { setSettings(false); void dashboard.demo(); })}{button('Rozłącz', () => void dashboard.disconnect())}</View>
      {settings && <View style={styles.panel}>
        <View style={styles.row}>{(['classic', 'ble', 'wifi'] as const).map(item => <React.Fragment key={item}>{button(item === 'classic' ? 'BT Classic' : item.toUpperCase(), () => { scanStop.current?.(); setDevices([]); setKind(item); }, kind === item)}</React.Fragment>)}</View>
        <Text style={styles.note}>{kind === 'wifi' ? 'Połącz telefon z siecią adaptera w ustawieniach Androida.' : kind === 'classic' ? 'Najpierw sparuj adapter w ustawieniach Androida.' : 'UUID zależą od adaptera. Domyślny profil FFF0 jest przykładem, nie uniwersalnym standardem.'}</Text>
        {kind !== 'wifi' && button(kind === 'ble' ? 'Skanuj BLE (10 s)' : 'Pokaż sparowane', () => void discover())}
        {devices.map(device => <React.Fragment key={device.id}>{button(`${device.name} · ${device.id}`, () => { scanStop.current?.(); setForm({ ...form, address: device.id }); }, form.address === device.id)}</React.Fragment>)}
        {(kind === 'wifi' ? ['host', 'port'] : kind === 'ble' ? ['address', 'service', 'tx', 'rx'] : ['address']).map(field => <View key={field}><Text style={styles.note}>{field.toUpperCase()}</Text><TextInput accessibilityLabel={field} style={styles.input} autoCapitalize="none" autoCorrect={false} value={form[field as keyof typeof form]} onChangeText={text => setForm({ ...form, [field]: text })} /></View>)}
        {!!error && <Text style={styles.error}>{error}</Text>}
        {button('Połącz', () => void connect())}
      </View>}
      <View style={styles.gauges}><Gauge label="ENGINE" value={value('rpm')} max={8000} unit="rpm" /><Gauge label="SPEED" value={value('speed')} max={240} unit="km/h" /></View>
      <View style={styles.metrics}>{(['coolant', 'intake', 'load', 'map'] as Metric[]).map(key => <View key={key} style={styles.metric}><Text style={styles.note}>{({ coolant: 'PŁYN', intake: 'DOLOT', load: 'OBCIĄŻENIE', map: 'MAP' } as Record<string, string>)[key]}</Text><Text style={styles.number}>{value(key) === undefined ? '—' : Math.round(value(key)!)} <Text style={styles.unit}>{pids[key].unit}</Text></Text></View>)}</View>
      <Text style={styles.note}>— brak odczytu lub dane starsze niż 5 s · MAP to ciśnienie absolutne, nie doładowanie</Text>
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: '#090b09' }, content: { padding: 20, paddingTop: 28, gap: 14 }, row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' }, title: { color: '#ffb35a', fontWeight: 'bold', fontSize: 24, letterSpacing: 3 }, status: { color: '#c6ae8b', fontSize: 13 }, amber: { color: '#ffb35a' }, button: { paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: '#454034', borderRadius: 5 }, selected: { backgroundColor: '#42301b', borderColor: '#ffb35a' }, panel: { padding: 16, gap: 12, backgroundColor: '#171914', borderRadius: 8 }, note: { color: '#afa58f', fontSize: 12 }, input: { color: '#ffbc70', borderBottomWidth: 1, borderColor: '#625137', padding: 10 }, error: { color: '#ff8768' }, gauges: { flexDirection: 'row', justifyContent: 'center', gap: 12 }, metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, metric: { flexGrow: 1, padding: 16, backgroundColor: '#171914', borderRadius: 4 }, number: { color: '#ffb35a', fontSize: 28, fontVariant: ['tabular-nums'] }, unit: { fontSize: 13 } });
