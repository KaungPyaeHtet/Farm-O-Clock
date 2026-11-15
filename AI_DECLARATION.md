# AI Use Declaration — Farm O'Clock

NASA Space Apps Challenge 2026 · Challenge: "Field Shift: Adapting Farms with NASA Data"

We declare how artificial intelligence (AI) tools were used to build this project. The team made every
design decision, checked the results, and takes responsibility for the submitted work.

## 1. AI inside the app: none

- The app does **not** call any generative AI or large language model (LLM) API. We chose this on purpose:
  farmers get the same answer every time, and no field data is sent to an AI service.
- The plan text and checklist (English / Burmese) come from a fixed template (`web/src/lib/brief.ts`).
- The rotation scores are rules plus measured inputs (`web/src/lib/strategies.ts`).
- The only machine-learning model is a small **logistic-regression** risk model that we trained ourselves on
  NASA POWER data (`backend/train_risk.py`, weights in `backend/models/`). It is a statistical model, not
  generative AI. Its accuracy, including where it has **no skill**, is reported in `backend/eval/REPORT.md` and `reports/`.
- The app supports farmers' judgment and does not replace it. Every screen says what the data shows, not what the farmer must do.

## 2. AI used while building the project

| Tool | What we used it for | How we checked it |
|---|---|---|
| Claude Code (Anthropic, Claude models): AI coding assistant | Writing and fixing code (Next.js web app, Python API, evaluation scripts), finding bugs, writing docs (README, reports), and help with the Burmese UI text | Team code review, automated tests (`pytest`, incl. TS ↔ Python parity), lint and type checks, backtests against 20+ years of NASA data, and manual testing of the live app |
| ChatGPT (OpenAI) | Text drafting (pitch script, submission text, explanations), image generation, help planning the demo video | The team edited all text and checked facts and numbers against our own results |
| Claude (Anthropic, chat) | Text drafting and editing, image generation, help with the video | Same as above |
| Gemini (Google) | Text drafting, image generation, help with the video | Same as above |
| Grok (xAI) | Creating the Farm O'Clock logo | The team chose and approved the final design |

What the team did itself: choosing the problem and users, the app flow and features, which data sources to use,
the decision not to use an LLM in the app, reviewing and testing all AI-assisted code, and checking the Burmese text.

## 3. Images, video and presentation

- App map imagery is Esri satellite tiles; charts in `reports/figures/` are generated from our own evaluation code.
- **Logo:** made with Grok (xAI).
- **Images in the pitch deck / video:** some were generated with ChatGPT, Claude and Gemini. They are illustrations only and
  are **not** satellite data or real photos of farms. All real data in the app and the charts come from the sources in section 4.
- **Video:** AI tools (ChatGPT, Claude, Gemini) helped with planning and scripting. The 30-second pitch video was assembled
  with Claude Code as code (`demo/pitch.html`, rendered frame by frame by `demo/render.mjs`) from **real screenshots of the live
  app** (`demo/capture.mjs`); no screen in it is mocked up or AI-generated. Every number shown comes from `reports/README.md`.
  The background music is an original track synthesised by code (`demo/music.py`), also written with Claude Code; no samples
  or copyrighted music. The on-screen script was drafted by the team and edited with Claude Code (`demo/SCRIPT.md`).
- **Text:** AI helped draft and edit text (pitch, submission, docs); the team reviewed every word and all numbers come from our own evaluations.
- We do not use NASA logos or imply NASA endorsement.

## 4. Data

All data is open and credited: NASA POWER, NASA SRTM, NASA MODIS NDVI (via Microsoft Planetary Computer),
SoilGrids (ISRIC), ESA WorldCover, Open-Meteo, FAOSTAT, OpenStreetMap Nominatim, Esri.
No AI-generated or synthetic data is shown to farmers as real measurements.

Signed, Farm O'Clock team — 15 November 2026
