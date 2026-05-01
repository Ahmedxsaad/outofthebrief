"""Single source of truth for fingerprint algorithm constants.

Any change here MUST be mirrored in
`frontend/js/services/audio-fingerprint.js`.
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class FingerprintConfig:
    # ── STFT ──
    sample_rate: int = 22050
    fft_size: int    = 2048      # 93 ms window, 10.7 Hz/bin
    hop_size: int    = 512       # 23 ms hop → ~43 frames/sec
    min_freq_hz: int = 300       # below: hum / rumble
    max_freq_hz: int = 8000      # above: hiss

    # ── Peak extraction ──
    peaks_per_frame: int  = 10
    local_max_radius: int = 3    # bins
    thresh_k: float       = 0.5  # adaptive: mean + k*std

    # ── Constellation hashing ──
    fan_out: int    = 5
    t_min: int      = 2          # min frame delta (~46 ms)
    t_max: int      = 100        # max frame delta (~2.3 s)
    freq_quant: int = 2          # bin quantisation tolerance

    @property
    def min_bin(self) -> int:
        return int(self.min_freq_hz * self.fft_size / self.sample_rate)

    @property
    def max_bin(self) -> int:
        return int(self.max_freq_hz * self.fft_size / self.sample_rate)


# Default singleton — matching is sensitive to config, so we keep one global set
DEFAULT = FingerprintConfig()
