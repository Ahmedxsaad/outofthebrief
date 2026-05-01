# NEXUS Listen — mobile

Expo app that records 3 seconds of mic audio and matches it against the
NEXUS backend catalog.

## How it works

1. Records mic audio for 3 s (iOS: WAV / LinearPCM, Android: m4a / AAC).
2. Uploads the file to `POST /api/match-audio`.
3. Backend decodes via ffmpeg, runs the same fingerprint pipeline used at
   build time, returns the matched track + confidence.
4. UI shows result. "Continuous" toggle keeps looping.

The phone never does FFT or hash computation — keeping the mobile build
trivially small and ensuring algorithm parity with the reference DB.

## Run

```bash
cd mobile
npm install
npm start          # opens Expo dev tools
```

Then scan the QR with Expo Go on a physical device, or press `a` / `i`
for an emulator.

## Pointing at the backend

Edit `app.json` → `expo.extra.apiBase`. Default: `http://192.168.1.154:8000`
(this machine's LAN IP at the time of generation). The phone must be on
the same network as the backend.

For a public deployment, set it to `https://your.domain` and ensure the
backend is reachable from the phone.

## Permissions

- iOS: `NSMicrophoneUsageDescription` already declared in `app.json`.
- Android: `RECORD_AUDIO` already declared in `app.json`.
