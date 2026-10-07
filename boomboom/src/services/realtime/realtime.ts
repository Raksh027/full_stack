import { env } from '@/config/env';
import { tokenManager } from '@/services/session/tokenManager';

import type { ClientEvents, ServerEvents } from './events';
import { RealtimeClient } from './RealtimeClient';

type UnauthorizedHandler = () => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setRealtimeUnauthorizedHandler(
  handler: UnauthorizedHandler | null,
) {
  unauthorizedHandler = handler;
}

export const realtime = new RealtimeClient<ServerEvents, ClientEvents>({
  url: env.WS_URL,
  getToken: tokenManager.getAccessToken,
  onUnauthorized: () => unauthorizedHandler?.(),
});
