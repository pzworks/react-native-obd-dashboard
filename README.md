# Retro OBD

Android React Native dashboard for ELM-compatible adapters: Bluetooth Classic/SPP, BLE GATT and Wi-Fi TCP. Retro amber instruments, live supported-PID discovery, demonstration mode and bounded reconnect attempts. This is an initial hardware-test build, not a Play Store release.

## Run

Use Node 22. Install Android Studio / Android SDK and Java compatible with the Expo-generated Android project, then connect an Android device with USB debugging enabled.

```sh
npm ci
npm run typecheck
npm test
npm run android
```

Subsequent development sessions: `npm start`. Expo Go cannot load these native Bluetooth/TCP modules. No backend, account or API key is needed.

For an installable APK using your own EAS account:

```sh
npx eas-cli build --platform android --profile preview
```

`eas.json` also includes development and production profiles. EAS may prompt to link the project and create Android signing credentials. Production publishing and billing are not configured.

## Adapters

| Transport | Setup |
| --- | --- |
| Bluetooth Classic | Pair in Android settings, open Adapter → BT Classic → Pokaż sparowane, select device and connect. Grant Nearby Devices permission. |
| BLE | Enable Bluetooth, scan, select adapter and enter its documented 128-bit service, TX and RX UUIDs. TX is written by the app; RX notifies the app. Example FFF0/FFF2/FFF1 defaults do not apply to every adapter. |
| Wi-Fi | Join the adapter network in Android settings, enter its IP and TCP port, then connect. Defaults 192.168.0.10:35000 are examples. Sockets explicitly use the Wi-Fi interface. |

ELM version labels on clones are not a compatibility guarantee. BLE and Classic are different transports. USB D+K CAN is not implemented.

## Data and behavior

Mode 01 supported PID discovery determines what is polled. RPM and speed get priority; coolant, intake temperature, engine load and manifold absolute pressure are polled less often. Unsupported or stale (>5 seconds) readings display `—`. MAP is absolute pressure, not boost. Values are never substituted with demo readings during a real session.

Commands are serialized and responses buffered until the ELM `>` prompt. A timed-out session is discarded to prevent a late response being assigned to the next command. Reconnect makes at most three retries with increasing delays. Leaving the foreground stops telemetry and disconnects; return and connect manually. Screen stays awake while a session/demo is active. Settings persist locally; no telemetry is uploaded.

Standard OBD emission data is not full BMW diagnostics. E39 525d (2001) and E46 M52TU support must be confirmed on the actual ECU. ABS, airbag, instrument cluster, oil temperature and manufacturer-specific parameters are outside this first version. No diagnostic write/reset commands are exposed.

## Hardware acceptance

Test parked, with ignition on and adequate battery charge:

1. Build and install the APK. Try demo and confirm the landscape layout on phone and tablet.
2. Test one physical adapter per transport. Record its actual model, firmware response, UUIDs or IP/port and Android version.
3. Connect separately to E39 and E46. Confirm supported PIDs and compare RPM, speed and coolant with a trusted diagnostic tool.
4. Unplug the adapter: readings clear, retries stop after the limit, no fake values appear.
5. Reconnect, background/foreground the app, deny permissions and try invalid UUID/IP configurations. Confirm no crash and no duplicate polling.
6. Test for at least 30 minutes; record response rate and connection stability. Do not claim adapter/vehicle compatibility before these checks pass.

## Validation and next scope

`npm test` covers PID decoding, support bitmaps, fragmented replies, serial execution, timeout isolation and disconnect cancellation. CI checks types, tests and Android JS export, then builds an installable release-mode test APK signed with the generated debug key. Download `retro-obd-test-apk` from the successful Actions run. This is not a store signing key. Physical adapter tests remain required.

Native dependency patches in `patches/` modernize Gradle namespaces, React Android dependencies, Bluetooth receiver registration and React instance event checks. `npm ci` applies them through `patch-package`. Local native compilation was blocked by unavailable Gradle download network access; treat the CI Android job as the native build gate.

Before Play Store release: validate native builds on target devices, adapter matrix, accessibility and layout; add custom visual assets, error diagnostics, trip storage/export, opt-in logging, billing, store listing and required policy declarations. No payments, ads or publishing happen in this change.
