export type RazorpayCheckoutOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  order_id: string;
  prefill?: {
    email?: string;
    name?: string;
    contact?: string;
  };
  theme?: { color?: string };
  mockCheckout?: boolean;
};

export type RazorpayCheckoutSuccess = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

export class RazorpayCheckoutCancelledError extends Error {
  constructor() {
    super('Payment cancelled');
    this.name = 'RazorpayCheckoutCancelledError';
  }
}

type NativeCheckout = {
  open: (options: Record<string, unknown>) => Promise<RazorpayCheckoutSuccess>;
};

function loadNativeCheckout(): NativeCheckout | null {
  try {
    const mod = require('react-native-razorpay') as { default?: NativeCheckout };
    return mod.default ?? (mod as unknown as NativeCheckout);
  } catch {
    return null;
  }
}

function isCancelled(error: unknown): boolean {
  if (error instanceof RazorpayCheckoutCancelledError) {
    return true;
  }
  const row = error as { code?: number | string; description?: string };
  const code = String(row?.code ?? '');
  const description = String(row?.description ?? '').toLowerCase();
  return (
    code === '0' ||
    code === '2' ||
    description.includes('cancel') ||
    description.includes('user closed')
  );
}

export async function openRazorpayCheckout(
  options: RazorpayCheckoutOptions,
): Promise<RazorpayCheckoutSuccess> {
  if (options.mockCheckout) {
    return {
      razorpay_payment_id: `pay_mock_${Date.now()}`,
      razorpay_order_id: options.order_id,
      razorpay_signature: 'mock',
    };
  }
  const checkout = loadNativeCheckout();
  if (!checkout?.open) {
    throw new Error(
      'Razorpay Checkout is not linked. Rebuild the app after installing react-native-razorpay.',
    );
  }
  try {
    return await checkout.open({
      key: options.key,
      amount: String(options.amount),
      currency: options.currency,
      name: options.name,
      description: options.description,
      order_id: options.order_id,
      prefill: options.prefill,
      theme: options.theme ?? { color: '#8B5CFF' },
    });
  } catch (error) {
    if (isCancelled(error)) {
      throw new RazorpayCheckoutCancelledError();
    }
    throw error;
  }
}
