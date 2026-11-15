"""Original 30 s soundtrack for the pitch video, synthesised from scratch (no samples, no copyright).

Scored to demo/pitch.html: tense clock + crack (0-5 s), logo shimmer (5 s), warm 100 BPM groove
over C-G-Am-F (7.2-24 s) with whooshes on scene cuts, riser into a big lift at 24 s, resolve + fade.
Run: backend/.venv/bin/python demo/music.py  ->  demo/music.wav
"""

from __future__ import annotations

import wave
from pathlib import Path

import numpy as np

SR = 44100
DUR = 30.0
N = int(SR * DUR)
rng = np.random.default_rng(7)
out = np.zeros(N)
verb_send = np.zeros(N)


def midi(n: float) -> float:
    return 440.0 * 2 ** ((n - 69) / 12)


def place(sig: np.ndarray, start: float, gain: float = 1.0, send: float = 0.0) -> None:
    i = int(start * SR)
    if i >= N:
        return
    j = min(N, i + len(sig))
    out[i:j] += sig[: j - i] * gain
    verb_send[i:j] += sig[: j - i] * gain * send


def env(n: int, a: float, r: float) -> np.ndarray:
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-3))
    tail = np.clip((n / SR - t) / max(r, 1e-3), 0, 1)
    return e * tail


def pad(notes: list[int], dur: float, bright: float = 6.0) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.zeros(n)
    for m in notes:
        for det in (-0.07, 0.0, 0.07):
            f = midi(m + det)
            for k in range(1, 11):  # soft band-limited saw
                s += np.sin(2 * np.pi * f * k * t + k * det) * (1 / k) * np.exp(-k / bright)
    return s / (len(notes) * 3) * env(n, 0.5, 0.8)


def pluck(m: int, dur: float = 0.45) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = midi(m)
    s = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t) + 0.12 * np.sin(6 * np.pi * f * t)
    return s * np.exp(-t / 0.16) * env(n, 0.003, 0.05)


def bass(m: int, dur: float) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = midi(m)
    return (np.sin(2 * np.pi * f * t) + 0.25 * np.sin(4 * np.pi * f * t)) * np.exp(-t / 0.5) * env(n, 0.01, 0.08)


def kick(dur: float = 0.45, low: float = 48) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = low + 95 * np.exp(-t * 32)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 7.5)


def noise_hit(dur: float, decay: float, hp: bool = True) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = rng.standard_normal(n)
    if hp:
        x = np.diff(x, prepend=0)  # brighter
    return x * np.exp(-t * decay)


def clap() -> np.ndarray:
    s = np.zeros(int(0.3 * SR))
    for d in (0.0, 0.011, 0.023):
        h = noise_hit(0.25, 28)
        i = int(d * SR)
        m = min(len(h), len(s) - i)
        s[i:i + m] += h[:m] * 0.6
    return s


def tick(f: float) -> np.ndarray:
    n = int(0.05 * SR)
    t = np.arange(n) / SR
    return (np.sin(2 * np.pi * f * t) * 0.8 + rng.standard_normal(n) * 0.25) * np.exp(-t * 260)




def whoosh(dur: float = 0.7) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = rng.standard_normal(n)
    # sweep the brightness up then down by mixing a dark and a bright copy
    dark = np.convolve(x, np.ones(40) / 40, mode="same")
    mix = np.sin(np.pi * t / dur)
    return (dark * (1 - mix) + x * 0.35 * mix) * np.sin(np.pi * t / dur) ** 2


def riser(dur: float) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 180 * (1200 / 180) ** (t / dur)
    ph = 2 * np.pi * np.cumsum(f) / SR
    tone = np.sin(ph) * 0.35 + np.sin(ph * 1.5) * 0.15
    nz = np.diff(rng.standard_normal(n), prepend=0) * 0.25
    return (tone + nz) * (t / dur) ** 2.2


def impact(dur: float = 2.2) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    boom = np.sin(2 * np.pi * (38 + 60 * np.exp(-t * 18)) * t) * np.exp(-t * 2.2)
    return boom + noise_hit(dur, 9, hp=False) * 0.35


# ---------------------------------------------------------------- 0-5 s: the broken calendar
place(pad([45, 52, 57, 60], 5.2, bright=2.5), 0.0, 0.55, send=0.4)  # A minor, dark
for i in range(10):  # clock tick-tock, speeding the tension
    place(tick(2600 if i % 2 == 0 else 1900), 0.2 + i * 0.5, 0.35)
place(riser(1.3), 2.0, 0.25)  # tension under the shaking calendar
crack = noise_hit(0.6, 14, hp=True) * 1.2 + impact(1.8)[: int(0.6 * SR)]
place(crack, 3.25, 0.7, send=0.5)  # tiles fall / ground cracks
place(impact(1.7), 3.25, 0.5, send=0.3)

# ---------------------------------------------------------------- 5 s: logo shimmer
place(pad([60, 64, 67, 71, 74], 2.6, bright=9), 5.0, 0.5, send=0.6)  # Cmaj9, bright
for i, m in enumerate([72, 76, 79, 83, 84]):
    place(pluck(m, 0.8), 5.05 + i * 0.07, 0.25, send=0.6)
place(riser(1.6), 5.6, 0.3)
place(whoosh(0.8), 6.85, 0.5)

# ---------------------------------------------------------------- 7.2-24 s: the groove (100 BPM)
BEAT = 0.6
start = 7.2
chords = [  # (root, chord tones) per 2 bars = 8 beats = 4.8 s
    (48, [60, 64, 67, 71]),   # Cmaj7
    (43, [59, 62, 67, 71]),   # G
    (45, [57, 60, 64, 69]),   # Am
    (41, [57, 60, 65, 69]),   # Fmaj7
]
t = start
k = 0
while t < 24.0 - 1e-6:
    root, tones = chords[k % 4]
    seg = min(8 * BEAT, 24.0 - t)
    place(pad(tones, seg + 0.4, bright=5), t, 0.42, send=0.35)
    for b in range(int(round(seg / BEAT))):
        bt = t + b * BEAT
        last_bar = bt >= 22.2  # build: drop the kick, let the riser carry
        if not last_bar:
            place(kick(), bt, 0.9)
            place(bass(root, BEAT * 0.95), bt, 0.55)
        if b % 2 == 1 and not last_bar:
            place(clap(), bt, 0.28, send=0.3)
        for h in (0, 0.5):  # hats on 8ths
            place(noise_hit(0.08, 60), bt + h * BEAT, 0.07 if h else 0.04)
        # plucky arpeggio, 8th notes, up an octave
        for h in (0, 0.5):
            m = tones[(b * 2 + int(h * 2)) % len(tones)] + 12
            place(pluck(m), bt + h * BEAT, 0.22, send=0.35)
    t += seg
    k += 1
for cut in (11.8, 18.1):  # scene changes
    place(whoosh(0.7), cut - 0.45, 0.45)
place(riser(1.8), 22.2, 0.45)

# ---------------------------------------------------------------- 24-30 s: the lift + resolve
place(impact(2.5), 24.0, 0.55, send=0.4)
place(pad([48, 60, 64, 67, 71, 74], 6.0, bright=8), 24.0, 0.55, send=0.5)  # big Cmaj9
for b in range(6):  # half-time kick for two bars
    place(kick(0.5, 44), 24.0 + b * BEAT * 2, 0.7)
    place(bass(36, BEAT * 1.9), 24.0 + b * BEAT * 2, 0.45)
melody = [76, 74, 72, 71, 72, 79, 76, 74, 72]  # gentle descending hook
for i, m in enumerate(melody):
    place(pluck(m, 0.9), 24.3 + i * 0.6, 0.3, send=0.5)
place(pluck(84, 2.5), 29.1, 0.2, send=0.8)

# ---------------------------------------------------------------- mix: sidechain, reverb, master
tt = np.arange(N) / SR
duck = np.ones(N)
for b in np.arange(start, 22.2, BEAT):
    m = tt >= b
    duck[m] *= 1 - 0.3 * np.exp(-(tt[m] - b) * 9)
mix = out * duck

ir_n = int(2.2 * SR)
ir_t = np.arange(ir_n) / SR
ir = rng.standard_normal(ir_n) * np.exp(-ir_t * 3.0)
ir[: int(0.01 * SR)] = 0
wet = np.fft.irfft(np.fft.rfft(verb_send, 2 * N) * np.fft.rfft(ir, 2 * N))[:N]
wet /= np.max(np.abs(wet)) + 1e-9

left = mix + 0.22 * wet
right = np.roll(mix, int(0.012 * SR)) * 0.96 + 0.22 * np.roll(wet, int(0.017 * SR))  # width
st = np.stack([left, right], axis=1)
st = np.tanh(st * 1.6) / np.tanh(1.6)  # gentle glue
fade_in = np.minimum(1, tt / 0.05)
fade_out = np.clip((DUR - tt) / 1.4, 0, 1) ** 1.5
st *= (fade_in * fade_out)[:, None]
st /= np.max(np.abs(st)) / 0.89  # peak about -1 dBFS

path = Path(__file__).with_name("music.wav")
with wave.open(str(path), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((st * 32767).astype("<i2").tobytes())
print(path)
