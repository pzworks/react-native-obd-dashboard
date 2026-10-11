import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { Connection } from './transports/types';
import { createTransport } from './transports/native';
import { ElmSession } from './obd/ElmSession';
import { Telemetry } from './obd/Telemetry';
import { Readings } from './obd/protocol';
export function useDashboard() {
  const [readings, setReadings] = useState<Readings>({});
  const [status, setStatus] = useState('Rozłączono');
  const [active, setActive] = useState(false);
  const generation = useRef(0);
  const current = useRef<{ session?: ElmSession; telemetry?: Telemetry; timer?: ReturnType<typeof setTimeout>; demo?: ReturnType<typeof setInterval> }>({});
  const cleanup = async () => {
    const old = current.current;
    current.current = {};
    clearTimeout(old.timer); clearInterval(old.demo); old.telemetry?.stop();
    try { await old.session?.close(); } catch {}
  };
  const disconnect = async () => {
    generation.current++; await cleanup(); setActive(false); setReadings({}); setStatus('Rozłączono');
  };
  const connect = async (config: Connection) => {
    const token = ++generation.current;
    await cleanup(); setReadings({}); setActive(true);
    if (token !== generation.current) return;
    const attempt = async (retry: number) => {
      if (token !== generation.current) return;
      setStatus(retry ? `Ponawiam połączenie (${retry}/3)` : 'Łączenie…');
      let recovering = false;
      const failure = async (error: Error) => {
        if (recovering || token !== generation.current) return;
        recovering = true; await cleanup();
        if (token !== generation.current) return;
        setReadings({});
        if (retry < 3) {
          setStatus(`${error.message}. Ponawiam…`);
          current.current.timer = setTimeout(() => void attempt(retry + 1), Math.min(8000, 1000 * 2 ** retry));
        } else { setStatus(error.message); setActive(false); }
      };
      try {
        const transport = await createTransport(config);
        if (token !== generation.current) { await transport.disconnect(); return; }
        const session = new ElmSession(transport);
        current.current.session = session;
        await transport.connect();
        if (token !== generation.current) { await session.close(); return; }
        await session.initialize();
        if (token !== generation.current) { await session.close(); return; }
        const telemetry = new Telemetry(session, values => { if (token === generation.current) setReadings(values); }, error => void failure(error));
        current.current.telemetry = telemetry;
        const available = await telemetry.start();
        if (token === generation.current && !recovering) setStatus(`LIVE · ${available.length} parametrów`);
      } catch (error) { await failure(error as Error); }
    };
    await attempt(0);
  };
  const demo = async () => {
    const token = ++generation.current;
    await cleanup(); if (token !== generation.current) return;
    setActive(true); setStatus('DEMO · dane symulowane');
    const start = Date.now();
    current.current.demo = setInterval(() => {
      const t = (Date.now() - start) / 1000, at = Date.now();
      setReadings({ rpm: { value: 2200 + Math.sin(t / 2) * 900, at }, speed: { value: 70 + Math.sin(t / 3) * 30, at }, coolant: { value: 89, at }, intake: { value: 24, at }, load: { value: 42, at }, map: { value: 145, at } });
    }, 200);
  };
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => { if (state !== 'active') void disconnect(); });
    return () => { subscription.remove(); generation.current++; void cleanup(); };
  }, []);
  return { readings, status, active, connect, disconnect, demo };
}
