"""Audio I/O — load, normalise, mono-mix, resample."""
import numpy as np
from scipy.io import wavfile
from scipy.signal import resample


def load_audio(path: str, target_sr: int) -> np.ndarray:
    """Read a WAV file → float32 mono samples at `target_sr`."""
    sr, data = wavfile.read(path)

    if data.dtype == np.int16:
        data = data.astype(np.float32) / 32768.0
    elif data.dtype == np.int32:
        data = data.astype(np.float32) / 2147483648.0
    elif data.dtype == np.float64:
        data = data.astype(np.float32)
    else:
        data = data.astype(np.float32)

    if data.ndim > 1:
        data = data.mean(axis=1)
    if sr != target_sr:
        data = resample(data, int(len(data) * target_sr / sr))
    return data.astype(np.float32)
