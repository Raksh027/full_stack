# BoomBoom — Frontend Architecture

React Native 0.87 (New Architecture) · TypeScript (strict) · Redux Toolkit + RTK Query · React Navigation 7.
Backend: FastAPI (separate repo), consumed over REST (`/api/v1`) and one WebSocket.

## Folder structure

```
App.tsx                      Entry point, re-exports src/app/App
src/
  app/                       Composition root
    App.tsx                  Root component (providers + RootNavigator)
    AppProviders.tsx         Gesture handler, Redux, SafeArea, Navigation
    bootstrap.ts             Wires services at startup, restores session
  config/
    env.ts                   Typed, zod-validated .env values
    constants.ts             Timeouts, page sizes, profile rules, realtime tuning
  store/
    index.ts                 configureStore, AppStore/AppDispatch types
    rootReducer.ts           All slices + RTK Query reducer
    hooks.ts                 useAppDispatch / useAppSelector / useAppStore
    listenerMiddleware.ts    Typed startAppListening
    listeners.ts             Cross-cutting side effects (persistence, socket, logout)
    appSlice.ts              Connectivity + realtime status
  services/                  Infrastructure, no feature knowledge
    api/                     baseApi, baseQuery (auth, refresh, retry), tags, FastAPI error parser
    session/tokenManager.ts  In-memory token cache backed by the Keychain
    storage/                 MMKV (fast KV) + Keychain (secrets)
    realtime/                WebSocket client with backoff, heartbeat, typed events
    network/                 NetInfo + AppState → RTK Query refetch-on-focus/reconnect
    media/                   Direct-to-object-storage uploads via presigned URLs
    i18n/                    i18next + device locale detection, typed keys
    logger/                  Logger with a pluggable crash reporter (Sentry etc.)
  features/                  One folder per business domain
    auth/                    Email, Google, Apple sign-in; session restore; schemas
    onboarding/              (screens only; data lives in profile)
    profile/                 My profile, photos, location, public profiles
    discovery/               Swipe feed (infinite), swipe/rewind
    matches/                 Matches, likes received, unmatch
    chat/                    Conversations, messages, optimistic send, realtime sync, typing/presence
    safety/                  Block and report
    settings/                Local app prefs (persisted) + server discovery/notification settings
    notifications/           Push device registration
    subscription/            Premium tiers, entitlements, purchase verification
  navigation/                Typed param lists, navigators, deep linking, navigationRef
  shared/                    Reusable, domain-agnostic code (types, utils, components, hooks)
  theme/                     Design tokens (to be added with UI)
  assets/                    Images, fonts, animations
  types/                     Global type augmentations
```

Each feature follows the same shape and exposes its public API through `index.ts`:

```
features/<name>/
  api/        RTK Query endpoints (baseApi.injectEndpoints)
  store/      Redux slices / thunks for client-only state
  services/   Native SDK wrappers or multi-step flows
  screens/    Screen components (UI)
  components/ Feature-specific components (UI)
  schemas.ts  zod schemas for forms
  types.ts    Domain types
  index.ts    Public exports
```

## Rules

1. **Server state lives in RTK Query, client state lives in slices.** Don't copy API data into slices.
2. **Features import from `services/` and `shared/`, never the other way around.** Import other features through their `index.ts`.
3. **Every endpoint is injected into the single `baseApi`** so auth, retry, and cache invalidation are shared.
4. **Secrets only go in the Keychain** (`secureStorage`). MMKV is for non-sensitive cached data.
5. **Lists are cursor-paginated** with `build.infiniteQuery`. The feed caps cached pages (`maxPages`) to bound memory.
6. **Use optimistic updates for anything the user taps repeatedly** (swipes, messages, reorder photos, toggles).
7. **The navigator is chosen by auth state** (`restoring` → nothing, `unauthenticated` → Auth, not onboarded → Onboarding, else Main).

## Data flow

- **Requests:** `baseQuery` adds the Bearer token. On a 401 it runs a single shared `/auth/refresh`, then retries the request. If refresh fails, it dispatches `sessionExpired`. Idempotent requests are retried with backoff on network errors and 5xx.
- **Startup:** `restoreSession` loads tokens from the Keychain and calls `/auth/me`. If the device is offline, it falls back to the cached session user so returning users can still open the app.
- **Logout / expiry:** tokens are cleared, the socket disconnects, the RTK Query cache is reset, and the cached session user is removed.
- **Realtime:** the socket connects once a session starts and disconnects when the app is backgrounded (push notifications cover that case). Events are written directly into the RTK Query cache (`message.new`, `message.read`), into slices (`typing`, `presence`), or trigger tag invalidation (`match.new`, `like.received`).
- **Photos:** request a presigned URL → `PUT` the file straight to storage (S3/GCS) → confirm with the API. Image bytes never go through the API servers.

## Backend contract (FastAPI)

- Base URL: `${API_URL}/api/v1`. WebSocket: `${WS_URL}?token=<accessToken>`.
- **JSON uses camelCase.** In Pydantic, configure `alias_generator=to_camel`, `populate_by_name=True`, and return responses `by_alias`.
- Errors use FastAPI's default shape: `{"detail": "message"}`, or the 422 validation list, which `parseApiError` turns into `fieldErrors`.
- Pagination: `?cursor=&limit=` returns `{ "items": [...], "nextCursor": "..." | null }`.
- Auth responses: `{ tokens: { accessToken, refreshToken }, user: SessionUser, isNewUser }`. `POST /auth/refresh {refreshToken}` returns `{ accessToken, refreshToken }` (the refresh token rotates).
- The WebSocket envelope is `{ "type": "message.new", "data": {...} }`. The client sends `{"type":"ping"}` every 25 s. To reject an expired token, close the socket with code `4401`.

Endpoints used by the app are in each feature's `api/*Api.ts`.

## Environments

`.env` (development), `.env.staging`, `.env.production`, loaded by `react-native-config` and validated at startup in `src/config/env.ts`.

- Android: `ENVFILE=.env.staging npm run android`, or use the `android:staging` / `android:release` scripts.
- iOS: add a scheme pre-build action per environment that writes `ENVFILE` (see the react-native-config README), or duplicate the scheme for each environment.

Put machine-specific overrides in `.env.local` (gitignored). Never put server secrets in these files, because they are embedded in the app binary.

## Native setup still required

| Item | What to do |
| --- | --- |
| Google Sign-In | Create OAuth clients in Google Cloud and set `GOOGLE_WEB_CLIENT_ID` / `GOOGLE_IOS_CLIENT_ID`. On iOS, add the reversed iOS client ID as a URL scheme in `Info.plist`. On Android, register the SHA-1 of your debug and release keystores. |
| Sign in with Apple | In Xcode, open the BoomBoom target, go to Signing & Capabilities, and add **Sign in with Apple**. Enable it on the App ID too. |
| Facebook Login | Set `FACEBOOK_APP_ID` (and backend `FACEBOOK_APP_SECRET`). In the Facebook app, add `boomboom://facebook-auth` as a Valid OAuth Redirect URI and request `email` + `public_profile`. Then rebuild the native app. |
| Deep links | Add the `boomboom` URL scheme (iOS `CFBundleURLTypes`, Android `intent-filter`), plus Universal Links / App Links for `boomboom.app`. |
| Push notifications | Add FCM/APNs (e.g. `@react-native-firebase/messaging` or `@notifee`), then call `registerDevice`. |
| Crash reporting | Install Sentry or Crashlytics and pass it to `setErrorReporter` in `bootstrap.ts`. |
| In-app purchases | Add `react-native-iap` (or RevenueCat) and verify receipts with `verifyPurchase`. |
| Location | Add a geolocation library plus permission strings, then call `updateLocation`. |

## Scripts

`npm run validate` runs the typecheck, lint, and tests. Also available: `typecheck`, `lint`, `format`, `test`, `pods`, `start:reset`.
