# Farm O'Clock: 30-second pitch script

Video: `demo/farm-oclock-pitch-music.mp4` (with music) · `demo/farm-oclock-pitch.mp4` (silent)
The same words appear on screen, lighting up word by word, so the video works with or without a voice.
To change the on-screen text or timing, edit `VO` in `demo/pitch.html` and run `node demo/render.mjs`.

## Voiceover (≈ 68 words, calm and confident, slightly upbeat)

| Time | Say this | On screen |
|---|---|---|
| 0.2 – 1.4 | Hi, we're Team NorthStar. | Team name, calendar tiles appear |
| 1.5 – 4.8 | Climate change broke the farming calendar. Now farmers gamble every harvest. | Calendar shakes, cracks and falls onto dry, cracked soil |
| 5.1 – 6.6 | So we built **Farm O'Clock**. | Logo reveal |
| 7.4 – 10.6 | Search any field, and live NASA data reads it instantly. | Search "Maubin", pin drops; soil moisture, rain, heat, slope cards pop out (NASA POWER · SRTM) |
| 12.0 – 16.4 | Pick your crop and goals. Our 20-season replay finds your safest sowing window. | Tap Rice + Save Water, the past-season grid lights up, the sowing pin is dragged |
| 18.3 – 21.9 | Stress-test rotations against extreme weather, and get a plan you can share. | Rain and heat sliders re-rank the plans, page 7, the share card slides in |
| 24.0 – 25.4 | Farm O'Clock. | The share card lands over green farmland |
| 25.6 – 29.2 | Because when the climate shifts, knowing when to plant changes everything. | Logo, "Powered by open NASA Earth data", link, Team NorthStar |

### Recording tips

- Record on a phone in a quiet room with soft furnishings (a closet full of clothes works well), 15–20 cm from the mouth.
- Read along with the video playing (muted) so you hit the timings; pause briefly at each scene change.
- Smile while you talk, and stress the lime-coloured words on screen (calendar, gamble, live NASA data, safest sowing window, extreme weather, when to plant).
- In CapCut / iMovie: put the voice on top of `farm-oclock-pitch-music.mp4` and lower the music to about 25–30 % while you speak
  (or use "auto-duck" / "reduce background" if the editor has it).

## Longer version (45–60 s, for a live pitch or a longer video)

> Picture a farmer looking at dry, cracked soil, wondering what to plant. What if they could see into the future?
> What if tomorrow's harvest was hidden in yesterday's data?
>
> Hi, we're Team NorthStar, and this is Farm O'Clock. Pin any field on Earth, and it pulls live NASA data on soil moisture,
> rain, heat and slope. Pick your crop and goals, and our replay of the last 20 seasons shows which sowing weeks went well,
> and which went badly. Then stress-test three crop rotations against drier or hotter seasons, and get a simple plan, with a
> field checklist, in English or Burmese, that you can share as a picture.
>
> It's not just a concept. It's a working tool, tested at 73 sites on five continents, and built for farmers in Myanmar.
> Farm O'Clock turns open NASA data into a starting point for resilient harvests, because when the climate shifts,
> knowing when to plant changes everything.

## Music

Original track, written as code in `demo/music.py` (no samples, no copyright to clear): tense clock ticks and a crack hit for
the broken calendar, a bright shimmer on the logo, a warm 100 BPM groove (C–G–Am–F) under the demo with whooshes on each
cut, and a lift into the farmland ending. Regenerate with `backend/.venv/bin/python demo/music.py`, then:

```
ffmpeg -y -i demo/farm-oclock-pitch.mp4 -i demo/music.wav -filter_complex "[1:a]loudnorm=I=-16:TP=-1.5:LRA=11[a]" \
  -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 256k -ar 48000 -shortest -movflags +faststart demo/farm-oclock-pitch-music.mp4
```
