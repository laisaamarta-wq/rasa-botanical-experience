# RASA: First Light (concept site) · v3 "UX & motion pass"

A concept brand and site for a premium botanical face oil. *Rasa* is Latvian/Lithuanian for **dew**.
Live: https://rasa-botanical-experience.vercel.app — deployed on Vercel from this repository. Every push to `main` redeploys.

## Open it

- **Dev server** (Node 18+): `npm install`, then `npm run dev`.
- **Production build:** `npm run build` → `dist/` (static; hashed, lazy-loaded assets). This is what Vercel builds (Vite preset, output `dist`, see `vercel.json`).
- **One-file offline version:** `npm run build:single` → `dist-local/index.html`, a self-contained file that opens by double-click.
- No environment variables, no server code, no API keys: the shop runs on a demo payment adapter (`src/payments.js`) and the bag lives in `localStorage`.

## What changed in v2

The whole site is now **one camera move**: a single scroll-driven film with no separate "sections". Every cut has a physical reason (a drop, a leaf, amber, light, mist, focus), and the bottle keeps coming back as the thread.

| # | Chapter | What the camera does | Speed |
|---|---|---|---|
| 01 | Enter the world | From darkness to a sharp dew drop; the camera leans in | medium |
| 02 | The source | The drop holds a birch leaf (dew lens). Across the leaf into one droplet, which holds heather | fast / medium |
| 03 | The ingredient | The camera pushes into the heather; the cloudberry comes out of the movement. Pull back to the whole bog, four plants labelled | fast |
| 04 | Meet the product | A push toward the hummock; the bottle grows out of the moss. Name, price, what it is, Buy | **slow hold** |
| 05 | Inside the product | Into the glass until amber is all there is → macro of glass, oil, frosted name | fast → medium |
| 06 | Three drops | Follow the pipette down (match cut on its tip) → three drops fall, counted as they land → dive into the pool → its surface *is* the oil inside the bottle → pull back, bottle revealed, it turns (drag works) | medium |
| 07 | Return to nature | Into the amber again; the amber turns into sunlight; we are standing in the cloudberries | fast |
| 08 | The ingredients | Cloudberry → tilt down into the moss under it → through the moss → focus slips to the mist → birch bark → the bead of sap holds the heather (lens) | medium, each a small world |
| 09 | The formula | The world draws back into the dark; four plants arrive one by one, circle, and fall into one point where the bottle appears. INCI list | medium |
| 10 | The ritual | Beside the bottle: three steps | quiet |
| 11 | Shop | The bog grows back around the bottle (matched in size and place). Buying happens in the landscape | **slow hold** |
| 12 | Return to nature | Ground mist rises over the bottle; when it sinks the bottle is gone; the camera pulls back over the bog. RASA | slow |

**Replaced:** the hand scene. "Three drops" is now a pure serum sequence (the only new asset, generated for this pass).

## v2.1 — transitions reworked

- The opening frame is now sharp. It fades in from darkness, with no blur.
- All the flat foliage cut-outs (the leaves, heather and moss sliding over the screen) are gone. Transitions now use real camera optics:
  - **moving forward:** radial motion blur as the camera pushes in (heather → cloudberry, into the glass, into the amber, into the pool)
  - **pulling back:** the same blur in reverse (berry → bog, oil → bottle)
  - **tilt:** vertical motion blur (down the pipette, from the berries down into the moss)
  - **ground mist:** it rises and clears with a soft, moving edge (moss → birch, and the ending where the bottle disappears into the mist)
  - focus pulls, dew lens and amber → light are unchanged.

## v3 — UX, motion & journey audit

I went through the film as a visitor several times (normal wheel pace, impatient flicks, rapid direction changes, full reverse, stopping in the middle of transitions, phone), then fixed what got in the way.

### What the audit found

| Area | Problem | Decision |
|---|---|---|
| Scroll | Every second of film got the same scroll distance (10vh). Transitions felt long, while the product reveal and the four plants went by in one flick | A **scroll hierarchy** (`SEGS` in `main.js`): optical transitions get SHORT scroll (6vh per unit), discoveries MEDIUM (8–9), the four plants and the product reveal LONG (12–14). The product hold now gets 1.4× more scroll, transitions about 0.6×. Overall about 11% shorter |
| Stopping mid-transition | Motion blur was tied to position, so a stopped camera stayed smeared and looked broken | Motion blur now follows **real camera speed**. Stop and the frame sharpens within about half a second |
| Slow user | A stopped frame was a still photo | A slow, tiny **camera breath** (screen-space, so matched cuts stay matched). The frame stays alive while you read |
| Fast user | Several 2.5K textures could upload in one frame (jank), and unloaded plates flashed black | Uploads are queued (one per frame, nearest first), the lookahead grows with speed, and if a plate isn't ready the last good frame stays up instead of black |
| Amber → light | At its peak the screen went flat yellow-white | Lower peak; the cloudberries start coming through earlier |
| Navigation | No way to see the structure, skip ahead, or come back. No phone navigation. The address never changed | **Chapter index** (click the chapter label, bottom left). Every chapter has an address (`#product`, `#formula`, `#shop` …) that deep-links. Jumps are history entries, so **Back** returns to where you were. Long jumps cut; short ones travel. Phone header gets a **Shop** pill |
| Clarity | The product only got named at 25% in. Eyebrows repeated the chapter numbers | The first screen names it: "First Light · botanical face oil from a northern bog". Chapter numbers now appear only in the label; eyebrows carry meaning ("Made from these four plants" above the bottle links source → product). Two chapters were both called "Return to nature"; the second ingredient chapter is now **Four plants**, so there are 11 chapters |
| Overlaps | The "amber comes from here" caption collided with the Cloudberry card. The chapter label sat over the intro, the Scroll cue and the footer | Re-timed. The label steps aside for the intro, the shop and the footer |
| Ending | It ended on the wordmark: "beautiful… now what?" | Under RASA: **Shop First Light · €84** and **Watch again** |
| Turntable | The bottle could be dragged, but nothing said so | "Drag to turn it" hint plus grab cursor (desktop) |
| Phone | Formula and ritual panels covered the bottle. The shop sheet hid the product at the moment of purchase. Light text was lost on bright sky | The bottle steps up and back to make room for the panels. Wider shop framing and a compact two-column card, so the bottle sits above it. Soft scrims behind captions |
| Performance | Overlay styles were rewritten every frame | Styles are only written when they change |

Checked after the changes: normal, fast down / jitter / full reverse, stop-mid-transition, nav → shop → Back, chapter index, deep link (`#ritual`), the full checkout, and the same on a 390×844 phone. No console errors.

## How it's built

- `src/stage.js` holds the film. One WebGL2 shader composites at most two photographs per frame. It has four transition modes: crossfade through blur/light/colour, *dew lens* (refraction), *emergence* (the bottle revealed from the ground up), and *amber → light*. The shot list is a pure function of one number `u` (0–200). `u` comes from native scroll through a piecewise scroll map, so nothing hijacks the wheel or touch. Textures are streamed: only the plates near the camera stay on the GPU (6 on mobile).
- The turntable and the drops are frame sequences uploaded to one texture each as you scroll.
- `src/main.js` keeps every caption, pinned label, hotspot, drop counter and formula orb on the same clock (`data-u="start,end"`).
- `src/shop.js` + `src/payments.js` contain the bag, the three-step demo checkout and a payment adapter (UI → `createIntent()` / `confirm()`; the demo provider charges nothing).
- On mobile the same film uses dedicated portrait crops, its own camera framing (it pans across the bog) and a bottom-sheet shop card and checkout.

## Concept notes

RASA is fictional. Ingredient copy, usage maths (≈100 days at 3 drops twice a day) and the INCI list are illustrative concept copy. No clinical, organic, certification or sourcing claims are made, and the checkout takes no payment.
