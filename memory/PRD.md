# PROMPTERA — Product Requirements & Build Log

**Owner:** PT Samudera Kreatif Indonesia
**Type:** Creator Camera + Teleprompter mobile app (Expo / React Native + FastAPI + MongoDB)

## Original problem statement
Build a professional, production-grade Creator Camera + Teleprompter app ("PROMPTERA") for iOS & Android: script management, real teleprompter engine, real camera/mic recording, local library, preview/share, DeepSeek-powered translation (secure backend gateway, disabled until key added), email/password auth, and a unified subscription/entitlement system fed by multiple payment providers (Midtrans/DANA/PayPal/RevenueCat/stores) with backend multi-country pricing. Premium dark UI with orange accent. Local-first; AI only on explicit user action.

## User choices (gathered)
- Translation: set up architecture, disabled until DeepSeek key added.
- Auth: email + password now (JWT); Google/Apple later.
- Subscription: unified entitlement + payment provider abstraction (Midtrans/DANA/PayPal), no live charges in this env.
- Default language: Bahasa Indonesia (English available).
- Priority: Scripts → Teleprompter → Camera/Recording → Preview → Library → Share. VoiceGlide + DOCX/PDF import are honest stubs with working manual mode.

## Architecture
- **Frontend:** Expo Router. Providers: I18n, Auth, Settings, Library, Toast, Query, SafeArea, Keyboard. Dark-only theme in `src/theme.ts`. Icons via `@react-native-vector-icons/ionicons`.
- **Local-first stores:** scripts, folders, recordings, teleprompter & camera settings persisted via `@/src/utils/storage` (AsyncStorage). No network needed for core flow.
- **Backend (`server.py`):** JWT auth (bcrypt), `/pricing` (multi-country catalog), unified subscription/entitlement (`/subscription/*`) with provider-agnostic webhook + dev-activate, AI gateway `/ai/translate` (DeepSeek, cached, daily quotas, disabled w/o key), `/ai/languages`, `/ai/usage`, privacy-safe `/analytics/event`.

## Implemented (2026-10-04)
- Onboarding (4 slides + contextual permission priming).
- Scripts: list, search, folder chips, favorites, create/edit/duplicate/delete, autosave, sample seed data.
- Script Editor: title/content, live word/char/duration, speaking-speed presets, import (clipboard/.txt), translate/teleprompter/record actions, sticky keyboard toolbar.
- Teleprompter engine: rAF auto-scroll, speed/font/line-spacing/position/mirror/opacity, play/pause, rewind/forward, restart, countdown, manual drag, reading zone.
- Camera screen: expo-camera video recording, front/back flip, mirror preview, countdown, record timer, teleprompter overlay, auto-hiding controls, permission gate w/ Open Settings. Web shows graceful "device only" state.
- Preview: expo-video playback, save-to-gallery, share, rename, delete, retake, edit-script.
- Library: grid/list, search, favorites, recording actions.
- Tools: Countdown, Speaking timer, Word counter, Reading speed, Script duration (all functional); VoiceGlide + AI Assistant (architecture info + Pro).
- Settings: account, teleprompter + camera controls, language toggle, support, legal, logout, version.
- Paywall: backend pricing (Rp249.000 / Rp1.199.000, ≈Rp99.917/mo, 60% save), plan select, provider sheet, restore, demo activate.
- Auth screen + Account screen (subscription status, cancel).
- Legal (Terms/Privacy placeholders), i18n (ID/EN).

## Implemented (2026-06, iteration 2)
- Folder Manager (`src/components/folders.tsx`): create / rename / delete folders (sheet from Scripts header), "Pindah ke folder" picker in script menu incl. create-on-the-spot. Store: `renameFolder`, `moveScript`.
- Recording thumbnails: `expo-video-thumbnails` frame grab on record (`camera.tsx`) + backfill for older clips in Library (`src/lib/thumbnails.ts`). Native only.
- Google Sign-In (Emergent managed auth): `POST /api/auth/session {session_id}` exchanges with Emergent, upserts user by email (identities += google), issues PROMPTERA JWT. Frontend `loginWithGoogle()` in AuthProvider (web redirect + native openAuthSessionAsync + deep-link fallbacks), Google button on `/auth`. Password login on Google-only accounts returns a clear 401.

## Honest limitations
- Camera recording / video playback / save-to-gallery / thumbnails: native only (not web preview). Mirror-save of final video not post-processed (preview mirror only) — flagged.
- VoiceGlide voice-following: architecture + manual mode only (no on-device ASR yet).
- DOCX/PDF import: .txt supported; DOCX/PDF stubbed with user message.
- Payments: real Midtrans/DANA/PayPal/RevenueCat need server credentials + webhooks; entitlement system is real and testable via dev-activate.
- Translation: disabled until DeepSeek key set server-side.

## Backlog / Next
- P1: rich-text highlights, sort options; Apple sign-in; cloud sync of scripts.
- P2: Live DeepSeek key wiring + AI hook/CTA/rewrite; VoiceGlide on-device ASR; save-mirrored transcode; DOCX/PDF parsing.
- P3: Folder sheet polish (auto-scroll to row on rename); migrate RN-web `shadow*` warnings.
