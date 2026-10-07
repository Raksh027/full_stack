# End-to-end test report

Date: 2026-10-07. Target: `http://127.0.0.1:8080` inside `backend-api-1`, database `boomboom` on `backend-postgres-1`.

Scripts: `backend/scripts/e2e_mobile_smoke.py`, `backend/scripts/e2e_feed_check.py`.

No mock API. `USE_MOCK_API` is false in the app env file. The smoke script talks to the running API.

## Results

| Step | HTTP | Database / note |
| --- | --- | --- |
| Health / ready | 200 | Postgres and Redis true |
| OTP request + verify, two users | 200 | `users` and `user_auth` rows |
| Profile patch with app enums | 200 | `profiles.gender` `woman`/`man`, `looking_for` `serious_love` |
| Location | 200 | `locations.geog` present, city Mumbai, distance 0 m |
| Onboarding complete | 200 | `onboarding_completed` true, visibility PUBLIC |
| Photo upload and confirm | 200 | `profile_media` count 1 each |
| Discovery before gender fix | 200, 0 cards | SQL rows existed; reciprocal filter dropped them |
| Discovery after gender fix | 200, 1 card each way | `ada_sees_ben=True`, `ben_sees_ada=True` |
| Mutual like | 200 | `matched=True` in API log, match list length 1 |
| Send message | 201 | Peer message list length 1 |
| Mark read | 200 | |
| Block / unblock | 201 / 200 | |
| Report | 201 | `report_created` log |
| Subscription me | 200 | |
| Unread count | 200 | |
| Device register | 201 | `device_registered` log |
| Refresh / logout | 200 | |
| Invalid token | 401 | `AUTH_SESSION_EXPIRED` |
| Public profile of the other user | 200 | |
| Unmatch with a user id | 404 | Does not delete a match by user id |
| Extra registration from same IP | 429 | `AUTH_RATE_LIMITED`, policy 5/hour per IP |

## Automated tests

| Suite | Result |
| --- | --- |
| `pytest tests/unit` in the API container | 145 passed |
| `pytest tests/integration` | Not run |
| `npm test` in `boomboom` | Not run. `node_modules` missing |
| Flutter | No project |

## Docker

`docker compose up -d --build api` succeeded. API, worker, Postgres, and Redis stayed up. Readiness passed after the rebuild. The discovery fix is in the image that is running.

## Not tested

Physical iPhone or Android device, `flutter` (there is no Flutter app), Apple/Google/Facebook login, Razorpay, App Store / Play billing, and a real FCM or APNs delivery.
