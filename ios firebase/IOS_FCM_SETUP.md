# iOS FCM setup

Firebase project: `boomboom-7712a`  
iOS bundle ID: `com.boomboom.app`  
Android package (unchanged): `com.boomboomapp.date`

This document is the iOS push procedure. Android stays on `google-services.json` and `docs/FCM_SETUP.md`. The API already sends through Firebase Admin. Do not put the Admin JSON or an APNs `.p8` key in the Flutter app.

Windows cannot build, sign, or deliver an iOS push. The steps below that need a Mac, Xcode, an Apple Developer account, or a physical iPhone are marked as such.

## What the repo already does

- `firebase_core` and `firebase_messaging` are in `pubspec.yaml`.
- `PushNotificationService` in `lib/features/notifications/push_notification_service.dart` initializes Firebase once, requests alert/badge/sound only when permission is still undetermined, reads the FCM token, listens for token refresh, and registers the device.
- iOS registration uses `platform: "ios"` on the existing client. Android still sends `android`. Web sends `web`.
- Payload posted by `NotificationRemoteDataSource.registerDevice`:

```json
{
  "token": "<FCM_TOKEN>",
  "platform": "ios",
  "deviceId": "<DEVICE_ID>",
  "appVersion": "<optional>"
}
```

- Endpoint: `POST /api/v1/notifications/devices`
- The full token is not written to logs.
- Foreground messages refresh the unread badge and skip a chat refresh when that conversation is already open.
- Background handler: `firebaseMessagingBackgroundHandler`.
- Notification tap uses `onMessageOpenedApp` and `getInitialMessage`, then the existing routes (chat, matches, likes, events, verification, notifications).

## 1. GoogleService-Info.plist

The iOS client file is at `ios/Runner/GoogleService-Info.plist` and is in the Runner target’s Copy Bundle Resources. It is for Firebase project `boomboom-7712a` and bundle ID `com.boomboom.app`.

Do not overwrite it unless a replacement file has the same project and bundle ID. `Firebase.initializeApp()` with no Dart options reads this file on iOS. If it is missing from the app bundle, initialization fails and the app continues without push. Device registration is skipped.

This plist is client configuration, the same class of file as `android/app/google-services.json`. It is allowed in git. Do not commit Firebase Admin JSON or APNs keys.

## 2. Flutter configuration

No second Firebase app is created. `FirebaseMessagingGateway.initialize` calls `Firebase.initializeApp()` only when `Firebase.apps` is empty.

Permission is requested from `PushNotificationService.syncAfterAuth` after a session exists (`UserController`). A later login does not call `requestPermission` again if iOS already authorized or denied it.

On iOS, `getToken()` waits briefly for the APNs token. If APNs is not ready, registration is skipped. `onTokenRefresh` registers the token when it arrives.

`ios/Podfile` targets iOS 15.0, matching the Xcode deployment target. On a Mac, after `flutter pub get`:

```bash
cd ios
pod install
cd ..
flutter build ios --no-codesign
```

`flutter build ios` still needs macOS. It will fail until `GoogleService-Info.plist` is in the Runner bundle and signing is configured.

## 3. Xcode capabilities (declared in the project)

Already set in source:

| Capability | Where |
|---|---|
| Push Notifications, development | `ios/Runner/Runner.entitlements` (`aps-environment` = `development`) used by Debug |
| Push Notifications, production | `ios/Runner/RunnerRelease.entitlements` (`aps-environment` = `production`) used by Release and Profile |
| Background Modes → Remote notifications | `UIBackgroundModes` / `remote-notification` in `ios/Runner/Info.plist` |
| Remote registration | `AppDelegate.swift` sets the notification center delegate and calls `registerForRemoteNotifications()` |

On a Mac, open `ios/Runner.xcworkspace` (not the `.xcodeproj` alone after pods exist) and confirm Signing & Capabilities still shows Push Notifications and Background Modes → Remote notifications for the Runner target. Associated domains for `boomboom.app` are unchanged.

Debug builds must be signed with a development provisioning profile that includes Push Notifications. Release, Profile, and TestFlight builds must use a distribution profile. The `aps-environment` value has to match that profile.

## 4. Apple Developer (manual)

In the Apple Developer account, for App ID `com.boomboom.app`:

1. Enable Push Notifications.
2. Create an APNs Authentication Key (`.p8`). Record the Key ID and the Apple Team ID. A certificate is an alternative; the key is preferred.
3. Keep the `.p8` file outside this repository. `.gitignore` ignores `*.p8`.

Do not commit the key, the Team ID as a secret file, or passwords.

## 5. Firebase Console (manual)

1. Project `boomboom-7712a`.
2. Add an iOS app if it is not there yet. Bundle ID: `com.boomboom.app`.
3. Download `GoogleService-Info.plist` and place it at `ios/Runner/GoogleService-Info.plist`.
4. Project settings → Cloud Messaging → Apple app configuration: upload the APNs authentication key, Key ID, and Team ID.
5. Leave the backend Admin credentials as they are. The API container already uses `FIREBASE_PROJECT_ID=boomboom-7712a` and `FIREBASE_CREDENTIALS_JSON=/run/secrets/firebase-admin.json`. Do not change those values and do not copy the Admin JSON into Flutter.

## 6. Backend contract

No backend change is required. `platform` is a string. The app sends `ios`.

`POST /api/v1/notifications/devices` stores the token. A new token for the same `deviceId` replaces the previous one. The API sends through Firebase Admin (`backend/app/core/push.py`), including an APNs payload with sound. Invalid tokens are dropped by the existing provider.

## 7. Testing (physical iPhone + Mac)

The iOS Simulator does not receive real FCM/APNs pushes. Use a physical iPhone.

1. Install a debug or TestFlight build of `com.boomboom.app` that contains the real `GoogleService-Info.plist`.
2. Sign in and allow notifications.
3. Confirm `GET /api/v1/notifications/devices` lists an active device with platform `ios`. Do not copy the raw token into tickets or logs.
4. `POST /api/v1/notifications/test` while the API has Firebase Admin configured.
5. Foreground: unread badge updates. An open chat does not get a duplicate chat treatment.
6. Background the app and trigger a like, match, or message. A system notification should appear.
7. Force-quit the app, trigger again, tap the notification. The existing route should open.

Debug builds use the development APNs environment. TestFlight and App Store builds use production. A token from one environment will not receive pushes sent to the other.

## 8. Troubleshooting

| Symptom | Check |
|---|---|
| App runs, no device row | `GoogleService-Info.plist` missing or not in the Runner target. `Firebase.initializeApp()` then fails quietly. |
| Permission never appears | It is requested only after auth, and only while status is not determined. Reset the app's notification setting on the iPhone if it was denied. |
| Token never registers | APNs key not uploaded, Push capability missing on the App ID, or `aps-environment` does not match the provisioning profile. |
| Android token works, iOS does not | Confirm the iOS app in Firebase is `com.boomboom.app` in `boomboom-7712a`, and the Admin project id is the same project. |
| TestFlight receives nothing | Release entitlement must be `production`, and the APNs key in Firebase must be the same team. |
| Simulator stays silent | Expected. Use a device. |

## 9. Commands

On this Windows machine:

```bash
flutter pub get
flutter analyze
```

On a Mac, after the plist is in place:

```bash
flutter pub get
cd ios && pod install && cd ..
flutter build ios --no-codesign
```

Then run on a device from Xcode or `flutter run` with the iPhone selected.
