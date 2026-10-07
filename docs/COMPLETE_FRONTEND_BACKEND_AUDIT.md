# BoomBoom frontend–backend audit

There is no Flutter app in this workspace. The mobile client is the React Native app in `boomboom`. The API is the FastAPI app in `backend`.

Evidence is from reading the client API modules, the FastAPI routers, a live Docker stack, and a real two-user flow against PostgreSQL. A screen opening is not treated as proof.

## Runtime evidence

| Check | Result |
| --- | --- |
| `GET /health` | 200, `status=ok` |
| `GET /ready` | 200, Postgres true, Redis true |
| Containers | `backend-api-1`, `backend-worker-1`, `backend-postgres-1`, `backend-redis-1`, `backend-admin-1` |
| OpenAPI before rebuild | 93 paths. Mobile routes the app calls were absent |
| OpenAPI after rebuild from current source | 138 paths, including `/auth/otp/verify`, `/discovery/feed`, `/profiles/me`, `/tonight`, `/travel/journeys`, `/subscriptions/plans` |
| Unit tests | `pytest tests/unit`: 145 passed |
| Integration pytest | Not run. Needs the test database fixture, not the live app database |
| React Native Jest / `tsc` | Not run. `boomboom/node_modules` is not installed |
| Flutter analyze / `flutter test` | Not applicable. No Flutter project |
| Physical device | Not tested |
| Google, Apple, Facebook, Razorpay, APNs, FCM delivery | Not tested. External credentials |

The first running API image was older than the source tree. `docker compose up -d --build api` loaded the current backend. After that, the app contract routes exist.

## Bug fixed during this audit

Discovery excluded people the app had just created.

The client stores gender as `woman` or `man`. Discovery’s reciprocal filter only recognized `Woman` and `Man`. A straight woman whose preference is `Men` never saw a straight man, and the reverse was also empty. `GET /discovery/feed` returned `count=0` even when both profiles, photos, and locations were in Postgres.

`_filters_that_include` in `backend/app/repositories/discovery.py` now accepts both forms. After the fix, the same two users see each other (`feed_count=1` each way). Unit test: `test_reciprocal_filter_accepts_app_genders`.

## Live flow that was executed

Two new accounts, OTP from `GET /api/v1/auth/dev/otp` (development only):

1. OTP request and verify: 200, tokens issued, user ids persisted.
2. `PATCH /profiles/me` with app values (`woman`/`man`, `straight`, `serious_love`): 200.
3. `PUT /profiles/me/location` Mumbai: 200, `locations.geog` set.
4. Onboarding complete: 200.
5. Photo upload URL, `PUT` bytes, confirm: 200. `profile_media` count = 1 each.
6. Discovery feed: each user sees the other.
7. Like both ways: match created, `matches` list has 1 row.
8. Send message: 201. The other user lists 1 message. Mark read: 200.
9. Block 201, unblock 200, report 201. Report row written (`report_created` in API logs).
10. Subscription read 200. Unread notification count 200. Device register 201.
11. Refresh 200. Logout 200. Bad access token 401 `AUTH_SESSION_EXPIRED`.
12. Other user’s public profile 200. Unmatch with a user id instead of a match id: 404.

Postgres was queried for the pair. Both rows had name, gender, orientation, goal, birth date, public visibility, onboarding complete, one photo, Mumbai, and a geography point. Distance between them was 0 meters.

Notification worker logged `notification_push_no_devices` for like, match, and message. The inbox write ran. Push was not delivered because those test users had no real FCM token until the later device-register call, and Firebase delivery was not asserted.

## Feature status

| Feature | Frontend | Backend route | Service | Database | Auth | Test | Status | Gap |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Email OTP sign-in | `authApi` `EmailSignInScreen` `VerifyOtpScreen` | `POST /auth/otp/request`, `POST /auth/otp/verify` | `MobileService` | `user_auth`, `users` | Public, then bearer | Live 200 | WORKING | Dev OTP peek is development-only |
| Session restore | `restoreSession` `GET /auth/me` | `GET /auth/me` | `MobileService.session_user` | `users` | Bearer | Live 200 | WORKING | |
| Refresh / logout | `baseQuery`, `signOut` | `POST /auth/refresh`, `POST /auth/logout` | `AuthService` | sessions | Refresh body / bearer | Live 200 / 401 | WORKING | |
| Password register/login | `signUpWithEmail` / `signInWithEmail` exist, no screen calls them | `POST /auth/register`, `POST /auth/login` | `AuthService` | `user_auth` | Public | Not this run | PARTIAL | Current UI is OTP only |
| Google / Apple / Facebook | `authThunks` | `POST /auth/google`, `/apple`, `/facebook` | `MobileService` | `user_auth` | Public token | Not tested | NOT_TESTED | External identity providers |
| Forgot password | API method only | `POST /auth/password/forgot` | `AuthService` | OTP store | Public | Not this run | PARTIAL | No dedicated reset screen in the current sign-in flow |
| Delete account | `DeleteAccountScreen` | `DELETE /users/me` | `MobileService.delete_account` | `users` | Bearer | Not this run | PARTIAL | Route exists; not executed, to avoid deleting the proof users |
| Edit profile | Onboarding + `EditProfileScreen` | `PATCH /profiles/me` | `MobileService.patch_profile` | `profiles` | Bearer | Live 200 | WORKING | |
| Photos | `uploadProfilePhoto` | upload-url, confirm, delete, order | `MobileService` / storage | `profile_media`, disk | Bearer | Live upload+confirm | WORKING | |
| Location | `LocationScreen` | `PUT /profiles/me/location` | `ProfileService.patch_location` | `locations` geography | Bearer | Live + SQL | WORKING | |
| Discovery feed | `HomeScreen` `BoomScreen` | `GET /discovery/feed` | `MobileService.discovery_feed` | profiles, locations, media | Bearer | Live, sees the other user | WORKING | Was broken for app gender values. Fixed |
| Map / nearby | `NearbyScreen` | `GET /discovery/map` | `MobileService.discovery_map` | PostGIS | Bearer | Not this run | PARTIAL | Same gender filter now fixed; map call not executed |
| Swipe like / match | `discoveryApi.swipe` | `POST /discovery/swipes` | `MobileService.swipe` | `likes`, `matches` | Bearer | Live match | WORKING | |
| Pass / rewind | swipe `pass`, `DELETE /discovery/swipes/last` | same | `MobileService` | `discovery_swipes` | Bearer | Not this run | PARTIAL | Endpoints exist |
| Likes lists / respond | `LikesScreen` | `/likes/received`, `/sent`, `/viewed`, respond | `MobileService` | `likes`, views | Bearer | Not this run | PARTIAL | |
| Unmatch | `matchesApi.unmatch` | `DELETE /matches/{match_id}` | `InteractionService` | `matches` | Bearer, participant | Wrong id returned 404 | PARTIAL | Happy-path unmatch not executed |
| Chat | `ConversationsScreen` `ChatScreen` | `/conversations`, messages, read | `ChatService` | `conversations`, `messages` | Bearer, member | Live send, list, read | WORKING | |
| Realtime | `RealtimeClient` `ws://…/ws` | gateway fan-out | `run_event_fanout` | Redis pub/sub | Query token | Not executed on a socket | PARTIAL | Fan-out now targets `/ws` members. No live socket client in this run |
| Blocks | `BlockedUsersScreen` chat safety | `/safety/blocks` | `DiscoveryService` | blocks | Bearer | Live block and unblock | WORKING | |
| Reports | `ReportScreen` | `POST /safety/reports` | `ReportService` | reports | Bearer | Live 201 | WORKING | |
| Verification selfie | `VerifyProfileScreen` | `/verification/start`, upload-url, submit | `VerificationService` | verification tables | Bearer | Not this run | PARTIAL | |
| Notification inbox | `NotificationsScreen` | `/notifications`, read, unread-count | `NotificationService` | notification inbox | Bearer | Unread count 200 | PARTIAL | List/read not executed |
| Device register | `pushNotifications.ts` | `POST /notifications/devices` | `NotificationService` | device tokens | Bearer | Live 201 | WORKING | |
| Push delivery | Firebase messaging | worker | `NotificationService` | inbox | Server | Worker logged no devices | NOT_TESTED | FCM/APNs credentials and a real device |
| Discovery prefs | `DiscoveryPreferencesScreen` | `/users/me/discovery-preferences` | `MobileService` | `preferences.filters` | Bearer | Written by onboarding audience | PARTIAL | Screen save not executed |
| Notification settings | `NotificationSettingsScreen` | `/users/me/notification-settings` | `MobileService` | preferences | Bearer | Not this run | PARTIAL | |
| Email change | `ChangeEmailSheet` | `/users/me/email-change` | `MobileService` | `user_auth` | Bearer | Not this run | PARTIAL | |
| Travel | travel screens | `/travel/arrivals`, `/countries`, `/journeys` | `MobileService` | journeys | Bearer | Not this run | PARTIAL | Routes present after rebuild |
| Free Tonight | tonight screens | `/tonight`, `/tonight/me` | `MobileService` | tonight posts | Bearer | Not this run | PARTIAL | |
| Subscription read | `PaywallScreen` | `GET /subscriptions/me`, `/plans` | `MobileService` | subscriptions | Bearer | `me` 200 | PARTIAL | |
| Razorpay checkout | `PaywallScreen` | `/subscriptions/razorpay/order`, `/verify` | billing | payments | Bearer | Not tested | NOT_TESTED | Needs Razorpay keys |
| Feedback | `SendFeedbackScreen` | none | mailto | none | none | Not tested | WORKING | Opens the mail client. Not an API |
| Favorites | no screen | `POST /favorites` | `InteractionService` | favorites | Bearer | Not used by the app | MISSING_FRONTEND | Backend exists. Do not duplicate it |
| Events | no screen | `/events` | `EventService` | events | Bearer | Not used by the app | MISSING_FRONTEND | |
| Admin | no mobile screen | `/admin/*` | admin services | moderation tables | staff JWT | Not this run | MISSING_FRONTEND | Admin UI is the separate container on port 3000 |

## Auth and security notes

- Protected calls without a valid bearer returned 401.
- Unmatch with another user’s id returned 404, not another user’s match.
- Registration is limited to 5 new accounts per hour per IP (`rl:register:{ip}`). That is why a later OTP request returned 429. Existing accounts can still request a login OTP.
- Upload URLs are signed JWTs. They appear in API access logs. Do not copy those log lines into tickets.

## What was not claimed

The React Native app was not launched on a phone or emulator in this run. Jest was not run. Store purchases, social login, and push delivery were not executed. Those stay `NOT_TESTED` or `PARTIAL`.
