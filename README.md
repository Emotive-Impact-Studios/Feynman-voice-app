# Feynman voice app

Voice-first learning on the Feynman Technique. The learner explains a topic out loud and an AI "curious student" asks short, naive questions. It never explains the answer.

This repository holds **build step 1: the voice loop prototype**. It exists to prove the feel of the loop and to measure the real cost per minute. The screen is deliberately plain because the visual direction is not decided.

## How the loop works

```
Phone                                   Serverless function (apps/api)          Gemini
-----                                   ------------------------------          ------
mic -> 16 kHz mono PCM
speech meter counts speaking seconds
tap "Done" -> WAV, base64  ---------->  POST /api/turn  ----------------------> audio + history + student prompt
                                                                         <---- { transcript, question } + token usage
                                        eSpeak (WASM) turns question
                                        into phonemes, works out cost
                           <----------  { question, phonemes, cost, timings }
Kitten TTS Nano (ONNX) speaks it
```

Choices worth knowing:

- **Gemini hears the audio directly.** There is no separate transcription step. It returns a transcript alongside the question, and later turns are sent back as that text, so each call only pays for the new audio.
- **Phonemes are made on the server.** Kitten TTS needs eSpeak phonemes, and eSpeak is awkward on a phone. The function phonemises the question (a few milliseconds) and the phone only runs the 24MB ONNX model. Nothing about the voice costs money per minute.
- **Only speaking time counts.** A simple energy meter on the phone counts seconds of actual speech, which is the figure the minutes balance will charge for. Cost per minute in the app uses that figure.
- **The Gemini key never reaches the phone.** The app holds only a throwaway prototype token.
- **Question marks are kept.** The Kitten TTS Python package swaps every full stop and question mark for a comma. We keep them so questions sound like questions.

## Layout

| Path | What it is |
| --- | --- |
| `apps/api` | The serverless function (`api/turn.ts` for Vercel), a local dev server, tests and the cost bench |
| `apps/mobile` | Expo app, one screen |
| `packages/kitten-tts` | Kitten TTS Nano in TypeScript: tokeniser, chunking, voice styles, WAV. Runs on Node and on the phone |
| `packages/audio` | Resampler, speech meter and base64 for the microphone side |
| `scripts/fetch-kitten-model.sh` | Downloads Kitten TTS Nano 0.8 (int8) from Hugging Face and converts the voices file |

## Running it

You need Node 22, an Android phone or an iPhone, and a Gemini API key.

```sh
npm install
./scripts/fetch-kitten-model.sh models/kitten        # for tests and the bench
npm run fetch-model -w @feynman/mobile               # bundles the model into the app
npm test
```

### 1. Measure cost without a phone

```sh
cp apps/api/.env.example apps/api/.env   # fill in GEMINI_API_KEY and check GEMINI_MODEL
cd apps/api && node --env-file=.env --import tsx scripts/cost-bench.ts
```

With no arguments it speaks a five-turn explanation of the heart with Kitten TTS and sends it to Gemini. Pass your own WAV files to use real voices, which is the better test.

### 2. Try the loop on a phone

```sh
cd apps/api && node --env-file=.env --import tsx dev.ts      # serves http://0.0.0.0:8787/api/turn
cp apps/mobile/.env.example apps/mobile/.env                  # point it at your computer's LAN IP
cd apps/mobile && npx expo run:android                        # or run:ios on a Mac
```

The app uses native ONNX Runtime, so it needs a development build. Expo Go will not work. Without a local Android or Xcode set-up, use `npx eas-cli@latest build --profile development`.

### 3. Deploy the function

Create a Vercel project with its root directory set to `apps/api`, add the variables from `apps/api/.env.example`, and point `EXPO_PUBLIC_API_URL` at the deployment.

## Prices

The cost maths reads prices from environment variables (US dollars per million tokens). The defaults are the introductory figures from the brief: $0.75 in and $3.75 out. Audio input has its own variable because Google has priced audio above text on earlier Flash models. Check the live price list before trusting the numbers.

## Known gaps, on purpose

- No accounts, database, uploads or minutes ledger yet. Those are build steps 2 to 5.
- No notes caching yet. The function accepts a `notes` string for now; step 3 swaps this for cached uploaded notes.
- Turn taking is tap to finish. Automatic end-of-turn detection comes once the feel is right.
- The student speaks after the whole question is synthesised. Streaming sentence by sentence would cut the wait on longer questions.
