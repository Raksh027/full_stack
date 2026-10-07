import { configureGoogleSignIn } from '@/features/auth/services/googleAuth';
import { restoreSession } from '@/features/auth/store/authThunks';
import { registerChatRealtime } from '@/features/chat/realtime/registerChatRealtime';
import { setupApiListeners } from '@/services/network/setupApiListeners';
import { bindPushLifecycle } from '@/services/push/bindPushLifecycle';
import { bindRealtimeLifecycle } from '@/services/realtime/bindRealtimeLifecycle';
import type { AppStore } from '@/store';

/** Wires up app-wide services. Returns a cleanup function. */
export function bootstrapApp(store: AppStore): () => void {
  configureGoogleSignIn();

  const cleanups = [
    setupApiListeners(store.dispatch),
    registerChatRealtime(store.dispatch),
    bindRealtimeLifecycle(store),
    bindPushLifecycle(store),
  ];

  store.dispatch(restoreSession());

  return () => cleanups.forEach(cleanup => cleanup());
}
