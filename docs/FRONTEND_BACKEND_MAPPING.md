# Frontend to backend mapping

Client base URL: `{API_URL}/api/v1`. Android emulator rewrites `localhost` to `10.0.2.2` in `boomboom/src/config/env.ts`. Auth header: `Authorization: Bearer <accessToken>`. JSON envelope: `{ success, data, error, request_id }`. The client unwraps `data` in `baseQuery.ts`.

There is no Flutter layer. Calls below are React Native RTK Query endpoints.

| App call | Method and path | Backend |
| --- | --- | --- |
| `requestLoginOtp` | POST `/auth/otp/request` | `mobile.py` `request_otp` |
| `verifyLoginOtp` | POST `/auth/otp/verify` | `mobile.py` `verify_otp` |
| `signInWithEmail` | POST `/auth/login` | `auth.py` `login` via `MobileService.login_with_password` |
| `signUpWithEmail` | POST `/auth/register` | `auth.py` `register` (no tokens until OTP) |
| `signInWithGoogleToken` | POST `/auth/google` | `mobile.py` `google_auth` |
| `signInWithAppleToken` | POST `/auth/apple` | `mobile.py` `apple_auth` |
| `signInWithFacebookToken` | POST `/auth/facebook` | `mobile.py` `facebook_auth` |
| `requestPasswordReset` | POST `/auth/password/forgot` | `mobile.py` `forgot_password` |
| `verifyEmail` | POST `/auth/email/verify` | returns session user after OTP |
| `resendVerificationEmail` | POST `/auth/email/verify/resend` | `auth.resend_otp` |
| `getSession` | GET `/auth/me` | `mobile.session_user` |
| token refresh | POST `/auth/refresh` `{ refreshToken }` | rotates refresh token |
| `revokeSession` | POST `/auth/logout` | revokes refresh token |
| `deleteAccount` | DELETE `/users/me` | `mobile.delete_account` |
| `getMyProfile` / `updateMyProfile` | GET/PATCH `/profiles/me` | `mobile.my_profile` / `patch_profile` |
| `completeOnboarding` | POST `/profiles/me/onboarding/complete` | `mobile.complete_onboarding` |
| photo upload | POST `/profiles/me/photos/upload-url`, POST `.../confirm`, DELETE photo, PUT order | `mobile` photo methods, `PUT /media/local/{key}` |
| `getProfile` | GET `/profiles/{userId}` | `profile.py` `get_public` |
| `updateLocation` | PUT `/profiles/me/location` | `mobile.update_location` |
| `recordProfileView` | POST `/profiles/{userId}/views` | `mobile.record_view` |
| email change | GET/POST `/users/me/email-change` and verify | `mobile` email-change methods |
| feed | GET `/discovery/feed` | `mobile.discovery_feed` |
| map | GET `/discovery/map` | `mobile.discovery_map` |
| swipe | POST `/discovery/swipes` | `mobile.swipe` |
| rewind | DELETE `/discovery/swipes/last` | `mobile.rewind_last_swipe` |
| matches | GET `/matches`, DELETE `/matches/{matchId}` | `matches.py` |
| likes | GET `/likes/received`, `/sent`, `/viewed` | `mobile.py` |
| respond / unlike | POST `/likes/received/{id}/respond`, DELETE `/likes/sent/{userId}` | `mobile.py` |
| conversations | GET/POST `/conversations` | `conversations.py` |
| messages | GET/POST `/conversations/{id}/messages` | `ChatService` |
| read | POST `/conversations/{id}/read` | `ChatService.mark_read` |
| realtime | WebSocket `{WS_URL}?token=` | `gateway.py` `/ws` |
| blocks | GET/POST `/safety/blocks`, DELETE `/safety/blocks/{userId}` | `safety.py` |
| report | POST `/safety/reports` | `mobile.report_user` |
| discovery prefs | GET/PATCH `/users/me/discovery-preferences` | `mobile` preference methods |
| notification settings | GET/PATCH `/users/me/notification-settings` | `mobile` notification settings |
| verification | POST `/verification/start`, `/upload-url`, `/submit` | `verification.py` |
| inbox | GET `/notifications`, unread-count, read, read-all | `notifications.py` |
| push device | POST `/notifications/devices`, DELETE `/notifications/devices/{id}` | `notifications.py` |
| subscription | GET `/subscriptions/me`, `/subscriptions/plans` | `mobile.py` (registered before the older subscription router) |
| Razorpay | POST `/subscriptions/razorpay/order`, `/verify` | `mobile.py` |
| store verify | POST `/subscriptions/verify` | `mobile.verify_purchase` |
| travel | `/travel/arrivals`, `/countries`, `/journeys` | `mobile.py` |
| tonight | GET/POST/PATCH/DELETE `/tonight`, GET `/tonight/me` | `mobile.py` |

Backend routes the app does not call: `/favorites`, `/events`, `/admin/*`, `/interests`, `/profile` (singular older profile API), `/likes` (older like API). The mobile routes above are the ones the app uses. Do not add a second copy of those older routes for the app.
