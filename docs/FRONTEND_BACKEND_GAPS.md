# Gaps

## Fixed

| Gap | Evidence | Fix |
| --- | --- | --- |
| Running API image did not include the mobile routes the app calls | OpenAPI had 93 paths and `POST /auth/otp/verify` returned 404 | Rebuilt `backend-api` from the current source. OpenAPI now has 138 paths |
| Discovery returned nobody for app genders | Two complete public profiles with photos in Mumbai, feed `count=0`. Preferences were `Men` / `Women`, stored genders `man` / `woman`. Reciprocal SQL only matched `Man` / `Woman` | `_filters_that_include` accepts `man`, `woman`, and `nonbinary` as well as the older title-case values |

## Still open

| Gap | Status | Why it was not closed here |
| --- | --- | --- |
| React Native app not launched | NOT_TESTED | No device/emulator session in this run. `node_modules` is missing, so Jest was not run |
| Social sign-in | NOT_TESTED | Needs Google, Apple, and Facebook credentials |
| Razorpay and store receipts | NOT_TESTED | External payment providers |
| FCM / APNs delivery | NOT_TESTED | Worker recorded like/match/message notifications and logged `notification_push_no_devices` |
| Realtime socket | PARTIAL | Server fan-out code sends remapped events to `/ws`. No WebSocket client was attached in this run |
| Travel, Free Tonight, verification selfie, email change, notification settings, likes tabs, rewind, unmatch happy path | PARTIAL | Routes exist and match the client. They were not executed in the live flow |
| Password sign-up screen | PARTIAL | Client exports the mutations. The visible sign-in screen uses email OTP |
| Favorites and events | MISSING_FRONTEND | Backend routes exist. The React Native app has no screens for them. No second API was added |
| Feedback | No backend | `SendFeedbackScreen` opens `mailto:`. That is intentional, not a missing endpoint |
| Flutter | MISSING | This repository does not contain a Flutter project |

## Not a product bug

Discovery requires at least one photo (`profile_media` exists). A profile with location and onboarding but no photo correctly stays out of the feed. The live run confirmed the pair appeared only after photo confirm.
