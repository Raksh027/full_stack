import 'dart:async';
import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:get/get.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../../backend/routesmatch.dart';
import '../../controller/user_controller.dart';
import '../../core/storage/prefs_storage.dart';
import '../events/event_deep_link_service.dart';
import '../shared/domain/repositories.dart';

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  try {
    await Firebase.initializeApp();
  } catch (_) {}
}

class PushPayload {
  const PushPayload({
    required this.type,
    required this.entityId,
    this.conversationId = '',
  });

  final String type;
  final String entityId;
  final String conversationId;

  factory PushPayload.fromMap(Map<String, dynamic> data) {
    return PushPayload(
      type: '${data['type'] ?? ''}',
      entityId:
          '${data['eventId'] ?? data['entity_id'] ?? data['entityId'] ?? data['relatedEntityId'] ?? ''}',
      conversationId:
          '${data['conversation_id'] ?? data['conversationId'] ?? ''}',
    );
  }
}

abstract class MessagingGateway {
  Future<bool> initialize();
  Future<bool> requestPermission();
  Future<String?> getToken();
  Stream<String> get onTokenRefresh;
  Stream<PushPayload> get onForeground;
  Stream<PushPayload> get onOpened;
  Future<PushPayload?> getInitialMessage();
}

class FirebaseMessagingGateway implements MessagingGateway {
  FirebaseMessaging? _messaging;
  bool ready = false;

  @override
  Future<bool> initialize() async {
    try {
      if (Firebase.apps.isEmpty) {
        await Firebase.initializeApp();
      }
      _messaging = FirebaseMessaging.instance;
      FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
      if (!kIsWeb && Platform.isAndroid) {
        await _messaging!.setForegroundNotificationPresentationOptions(
          alert: false,
          badge: true,
          sound: false,
        );
      }
      if (!kIsWeb && Platform.isIOS) {
        await _messaging!.setForegroundNotificationPresentationOptions(
          alert: true,
          badge: true,
          sound: true,
        );
      }
      ready = true;
      return true;
    } catch (_) {
      ready = false;
      return false;
    }
  }

  @override
  Future<bool> requestPermission() async {
    if (_messaging == null) return false;
    final current = await _messaging!.getNotificationSettings();
    if (current.authorizationStatus == AuthorizationStatus.authorized ||
        current.authorizationStatus == AuthorizationStatus.provisional) {
      return true;
    }
    if (current.authorizationStatus == AuthorizationStatus.denied) {
      return false;
    }
    final settings = await _messaging!.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );
    return settings.authorizationStatus == AuthorizationStatus.authorized ||
        settings.authorizationStatus == AuthorizationStatus.provisional;
  }

  @override
  Future<String?> getToken() async {
    if (_messaging == null) return null;
    try {
      if (!kIsWeb && Platform.isIOS) {
        var apns = await _messaging!.getAPNSToken();
        if (apns == null) {
          await Future<void>.delayed(const Duration(milliseconds: 800));
          apns = await _messaging!.getAPNSToken();
        }
        if (apns == null) return null;
      }
      return await _messaging!.getToken();
    } catch (_) {
      return null;
    }
  }

  @override
  Stream<String> get onTokenRefresh =>
      _messaging?.onTokenRefresh ?? const Stream.empty();

  @override
  Stream<PushPayload> get onForeground => FirebaseMessaging.onMessage
      .map((message) => PushPayload.fromMap(message.data));

  @override
  Stream<PushPayload> get onOpened => FirebaseMessaging.onMessageOpenedApp
      .map((message) => PushPayload.fromMap(message.data));

  @override
  Future<PushPayload?> getInitialMessage() async {
    if (_messaging == null) return null;
    final message = await _messaging!.getInitialMessage();
    if (message == null) return null;
    return PushPayload.fromMap(message.data);
  }
}

class FakeMessagingGateway implements MessagingGateway {
  final tokenController = StreamController<String>.broadcast();
  final foregroundController = StreamController<PushPayload>.broadcast();
  final openedController = StreamController<PushPayload>.broadcast();
  String? token;
  PushPayload? initial;
  bool permissionGranted = true;
  bool initialized = false;

  @override
  Future<bool> initialize() async {
    initialized = true;
    return true;
  }

  @override
  Future<bool> requestPermission() async => permissionGranted;

  @override
  Future<String?> getToken() async => token;

  @override
  Stream<String> get onTokenRefresh => tokenController.stream;

  @override
  Stream<PushPayload> get onForeground => foregroundController.stream;

  @override
  Stream<PushPayload> get onOpened => openedController.stream;

  @override
  Future<PushPayload?> getInitialMessage() async => initial;
}

typedef AppVersionReader = Future<String?> Function();

Future<String?> packageAppVersion() async {
  try {
    final info = await PackageInfo.fromPlatform();
    final version = info.version.trim();
    final build = info.buildNumber.trim();
    if (version.isEmpty) return null;
    if (build.isEmpty) return version;
    return '$version+$build';
  } catch (_) {
    return null;
  }
}

class PushNotificationService extends GetxService {
  PushNotificationService({
    MessagingGateway? messaging,
    NotificationRepository? repository,
    AppVersionReader? appVersion,
  })  : _messaging = messaging ?? FirebaseMessagingGateway(),
        _repository = repository,
        _appVersion = appVersion ?? packageAppVersion;

  final MessagingGateway _messaging;
  final NotificationRepository? _repository;
  final AppVersionReader _appVersion;
  final List<StreamSubscription<dynamic>> _subs = [];
  PushPayload? pending;
  String? registeredDeviceId;
  String? lastToken;

  NotificationRepository get repo =>
      _repository ?? Get.find<NotificationRepository>();

  Future<void> start() async {
    final ready = await _messaging.initialize();
    if (!ready) return;
    pending = await _messaging.getInitialMessage();
    _subs.add(_messaging.onOpened.listen(_queueOrOpen));
    _subs.add(_messaging.onForeground.listen(_onForeground));
    _subs.add(_messaging.onTokenRefresh.listen((token) {
      unawaited(registerToken(token));
    }));
  }

  Future<void> syncAfterAuth() async {
    final ready = await _messaging.initialize();
    if (!ready) return;
    await _messaging.requestPermission();
    final token = await _messaging.getToken();
    if (token != null && token.isNotEmpty) {
      await registerToken(token);
    }
  }

  Future<void> registerToken(String token) async {
    lastToken = token;
    if (!Get.isRegistered<NotificationRepository>() && _repository == null) {
      return;
    }
    String? deviceId;
    if (Get.isRegistered<PrefsStorage>()) {
      deviceId = await Get.find<PrefsStorage>().fcmDeviceId();
    }
    final platform = kIsWeb
        ? 'web'
        : Platform.isIOS
            ? 'ios'
            : 'android';
    final appVersion = await _appVersion();
    final result = await repo.registerDevice(
      token: token,
      platform: platform,
      deviceId: deviceId,
      appVersion: appVersion,
    );
    result.when(
      success: (id) => registeredDeviceId = id,
      error: (_) {},
    );
  }

  void _onForeground(PushPayload payload) {
    if (Get.isRegistered<UserController>()) {
      final user = Get.find<UserController>();
      if (payload.type == 'NEW_MESSAGE' &&
          user.isViewingConversation(payload.conversationId.isNotEmpty
              ? payload.conversationId
              : payload.entityId)) {
        return;
      }
      unawaited(user.refreshNotificationBadge());
    }
  }

  void _queueOrOpen(PushPayload payload) {
    if (Get.isRegistered<UserController>()) {
      unawaited(open(payload));
    } else {
      pending = payload;
    }
  }

  Future<void> consumePending() async {
    final payload = pending;
    pending = null;
    if (payload != null) {
      await open(payload);
    }
  }

  Future<void> open(PushPayload payload) async {
    switch (payload.type) {
      case 'NEW_MESSAGE':
        final target = payload.conversationId.isNotEmpty
            ? payload.conversationId
            : payload.entityId;
        Get.toNamed(Routes.chatConversation, arguments: target);
        return;
      case 'MATCH_CREATED':
        Get.toNamed(Routes.newMatches);
        return;
      case 'LIKE_RECEIVED':
        Get.toNamed(Routes.bottomBar);
        return;
      case 'EVENT_UPDATE':
        if (payload.entityId.isEmpty) return;
        if (Get.isRegistered<EventDeepLinkService>()) {
          await Get.find<EventDeepLinkService>().handleEventId(payload.entityId);
        }
        return;
      case 'VERIFICATION_SUBMITTED':
      case 'VERIFICATION_APPROVED':
      case 'VERIFICATION_REJECTED':
      case 'VERIFICATION_RESULT':
        Get.toNamed(Routes.selfieVerification);
        return;
      default:
        Get.toNamed(Routes.notifications);
    }
  }

  @override
  void onClose() {
    for (final sub in _subs) {
      unawaited(sub.cancel());
    }
    super.onClose();
  }
}
