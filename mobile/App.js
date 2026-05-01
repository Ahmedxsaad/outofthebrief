import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Audio } from 'expo-av';
import Constants from 'expo-constants';

const API_BASE = Constants.expoConfig?.extra?.apiBase || 'http://localhost:8000';
const CLIENT_ID = 'mobile_' + Math.random().toString(36).slice(2, 10);
const CLIP_MS   = 3000;

// Cross-platform recording config — iOS records WAV, Android records m4a/aac.
// The backend decodes both via ffmpeg, so we don't care about the exact format.
const RECORDING_OPTIONS = {
  isMeteringEnabled: false,
  android: {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 22050,
    numberOfChannels: 1,
    bitRate: 96000,
  },
  ios: {
    extension: '.wav',
    outputFormat: Audio.IOSOutputFormat.LINEARPCM,
    audioQuality: Audio.IOSAudioQuality.MEDIUM,
    sampleRate: 22050,
    numberOfChannels: 1,
    bitRate: 96000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: { mimeType: 'audio/webm', bitsPerSecond: 128000 },
};

export default function App() {
  const [status, setStatus] = useState('idle');     // idle | listening | matching | matched | nomatch | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [continuous, setContinuous] = useState(false);
  const [matchCount, setMatchCount] = useState(0);

  const continuousRef = useRef(continuous);
  useEffect(() => { continuousRef.current = continuous; }, [continuous]);

  // Request mic permission once on mount
  useEffect(() => {
    (async () => {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') setError('Microphone permission denied');
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
    })();
  }, []);

  async function recordAndMatchOnce() {
    setStatus('listening'); setError(null);

    let recording;
    try {
      const r = new Audio.Recording();
      await r.prepareToRecordAsync(RECORDING_OPTIONS);
      await r.startAsync();
      recording = r;

      await new Promise((resolve) => setTimeout(resolve, CLIP_MS));

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();

      setStatus('matching');

      // Multipart upload of the recorded file
      const form = new FormData();
      form.append('file', {
        uri,
        name: uri.endsWith('.wav') ? 'clip.wav' : 'clip.m4a',
        type: uri.endsWith('.wav') ? 'audio/wav' : 'audio/mp4',
      });
      form.append('client_id', CLIENT_ID);

      const res = await fetch(`${API_BASE}/api/match-audio`, {
        method: 'POST',
        body: form,
      });
      if (!res.ok) throw new Error(`server ${res.status}`);
      const json = await res.json();

      setResult(json);
      if (json.matched) {
        setStatus('matched');
        setMatchCount((n) => n + 1);
      } else {
        setStatus('nomatch');
      }
    } catch (e) {
      console.warn('match error', e);
      setError(e.message || 'unknown error');
      setStatus('error');
      try { await recording?.stopAndUnloadAsync(); } catch {}
    }
  }

  // Continuous mode: schedule the next round after each one finishes
  useEffect(() => {
    if (status !== 'matched' && status !== 'nomatch' && status !== 'error') return;
    if (!continuousRef.current) return;
    const t = setTimeout(recordAndMatchOnce, 800);
    return () => clearTimeout(t);
  }, [status]);

  const busy = status === 'listening' || status === 'matching';

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Text style={styles.brand}>NEXUS</Text>
      <Text style={styles.subtitle}>broadcast listener</Text>

      <View style={styles.card}>
        <ResultBlock status={status} result={result} error={error} />
      </View>

      <Pressable
        onPress={recordAndMatchOnce}
        disabled={busy}
        style={({ pressed }) => [
          styles.button,
          busy && styles.buttonBusy,
          pressed && !busy && styles.buttonPressed,
        ]}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>
            {status === 'idle' ? 'LISTEN' : 'LISTEN AGAIN'}
          </Text>
        )}
      </Pressable>

      <View style={styles.row}>
        <Text style={styles.rowLabel}>Continuous</Text>
        <Switch
          value={continuous}
          onValueChange={(v) => {
            setContinuous(v);
            if (v && !busy) recordAndMatchOnce();
          }}
          trackColor={{ true: '#6B2BFF', false: '#333' }}
        />
      </View>

      <Text style={styles.footer}>
        {matchCount} match{matchCount === 1 ? '' : 'es'} this session
      </Text>
      <Text style={styles.api}>{API_BASE}</Text>
    </View>
  );
}

function ResultBlock({ status, result, error }) {
  if (status === 'idle') {
    return <Text style={styles.muted}>Tap LISTEN to identify nearby audio.</Text>;
  }
  if (status === 'listening') {
    return <Text style={styles.muted}>Recording {CLIP_MS / 1000}s of audio…</Text>;
  }
  if (status === 'matching') {
    return <Text style={styles.muted}>Matching against the catalog…</Text>;
  }
  if (status === 'error') {
    return <Text style={styles.error}>{error || 'Error'}</Text>;
  }
  if (status === 'nomatch') {
    return (
      <View style={{ alignItems: 'center' }}>
        <Text style={styles.icon}>🔍</Text>
        <Text style={styles.title}>No match</Text>
        <Text style={styles.muted}>
          coherence {result?.coherence ?? 0} / {result?.query_hash_count ?? 0} hashes
        </Text>
      </View>
    );
  }
  // matched
  const isRadio = (result?.brand || '').toLowerCase().includes('mosaique');
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={styles.icon}>{isRadio ? '📻' : '📺'}</Text>
      <Text style={styles.title}>{result.track_name}</Text>
      <Text style={styles.brandLine}>{result.brand}</Text>
      <Text style={styles.confidence}>
        {Math.round(result.confidence * 100)}% confidence
      </Text>
      <Text style={styles.muted}>
        {result.total_hits} hits · {result.coherence} coherent
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#0a0a0e',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  brand: { color: '#fff', fontSize: 32, fontWeight: '800', letterSpacing: 4 },
  subtitle: { color: '#666', fontSize: 12, letterSpacing: 2, marginBottom: 32 },
  card: {
    width: '100%', minHeight: 160, padding: 24, marginBottom: 24,
    backgroundColor: '#15151c', borderRadius: 12,
    borderWidth: 1, borderColor: '#222',
    alignItems: 'center', justifyContent: 'center',
  },
  icon: { fontSize: 44, marginBottom: 8 },
  title: { color: '#f0f0f8', fontSize: 18, fontWeight: '600', marginBottom: 4 },
  brandLine: { color: '#888', fontSize: 13, marginBottom: 8 },
  confidence: { color: '#22c55e', fontSize: 14, fontWeight: '500', marginBottom: 6 },
  muted: { color: '#666', fontSize: 12, textAlign: 'center' },
  error: { color: '#ef4444', fontSize: 13, textAlign: 'center' },
  button: {
    backgroundColor: '#6B2BFF', paddingVertical: 16, paddingHorizontal: 48,
    borderRadius: 100, minWidth: 220, alignItems: 'center',
  },
  buttonBusy: { backgroundColor: '#3a1f7a' },
  buttonPressed: { backgroundColor: '#5a22dd' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 1.5 },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 24, width: 220,
  },
  rowLabel: { color: '#888', fontSize: 13 },
  footer: { marginTop: 32, color: '#444', fontSize: 11 },
  api: { marginTop: 4, color: '#333', fontSize: 10, fontFamily: 'monospace' },
});
