import { baseApi } from '@/services/api/baseApi';
import type { ISODateString } from '@/shared/types/api';
import { extractList, normalizeSubscription } from '@/shared/utils/normalizeApi';
import { asId, asNumber, asRecord, asString } from '@/shared/utils/safeValue';

export type SubscriptionTier = 'free' | 'plus' | 'gold';

export type Subscription = {
  tier: SubscriptionTier;
  expiresAt: ISODateString | null;
  willRenew: boolean;
  entitlements: {
    unlimitedLikes: boolean;
    seeWhoLikedYou: boolean;
    rewind: boolean;
    superlikesPerDay: number;
    boostsPerMonth: number;
  };
};

export type SubscriptionPlan = {
  id: string;
  tier: Exclude<SubscriptionTier, 'free'>;
  storeProductId: string;
  durationMonths: number;
  displayPrice?: string;
  amountPaise?: number;
  currency?: string;
};

export const subscriptionApi = baseApi.injectEndpoints({
  endpoints: build => ({
    getSubscription: build.query<Subscription, void>({
      query: () => '/subscriptions/me',
      transformResponse: (response: unknown) => normalizeSubscription(response),
      providesTags: ['Subscription'],
    }),
    getSubscriptionPlans: build.query<SubscriptionPlan[], void>({
      query: () => '/subscriptions/plans',
      transformResponse: (response: unknown) =>
        extractList(response).flatMap(item => {
          const row = asRecord(item);
          const id = asId(row.id);
          if (!id) {
            return [];
          }
          const tier = asString(row.tier);
          return [
            {
              id,
              tier: tier === 'gold' ? 'gold' : 'plus',
              storeProductId: asString(row.storeProductId),
              durationMonths: asNumber(row.durationMonths, 1),
              displayPrice: asString(row.displayPrice) || undefined,
              amountPaise: asNumber(row.amountPaise, 0) || undefined,
              currency: asString(row.currency) || undefined,
            } satisfies SubscriptionPlan,
          ];
        }),
    }),
    verifyPurchase: build.mutation<
      Subscription,
      { platform: 'APPLE' | 'GOOGLE'; receipt: string; productId: string }
    >({
      query: body => ({ url: '/subscriptions/verify', method: 'POST', body }),
      transformResponse: (response: unknown) => normalizeSubscription(response),
      invalidatesTags: ['Subscription', 'Session'],
    }),
    createRazorpayOrder: build.mutation<
      {
        keyId: string;
        orderId: string;
        amount: number;
        currency: string;
        name: string;
        description?: string;
        mockCheckout: boolean;
        displayPrice?: string;
        prefill: { email?: string; name?: string };
      },
      { productId: string }
    >({
      query: body => ({
        url: '/subscriptions/razorpay/order',
        method: 'POST',
        body,
      }),
      transformResponse: (response: unknown) => {
        const row = asRecord(response);
        return {
          keyId: asString(row.keyId),
          orderId: asString(row.orderId),
          amount: asNumber(row.amount, 0),
          currency: asString(row.currency) || 'INR',
          name: asString(row.name) || 'BoomBoom',
          description: asString(row.description) || undefined,
          mockCheckout: Boolean(row.mockCheckout),
          displayPrice: asString(row.displayPrice) || undefined,
          prefill: {
            email: asString(asRecord(row.prefill).email) || undefined,
            name: asString(asRecord(row.prefill).name) || undefined,
          },
        };
      },
    }),
    verifyRazorpayPayment: build.mutation<
      Subscription,
      {
        productId: string;
        orderId: string;
        paymentId: string;
        signature: string;
      }
    >({
      query: body => ({
        url: '/subscriptions/razorpay/verify',
        method: 'POST',
        body,
      }),
      transformResponse: (response: unknown) => normalizeSubscription(response),
      invalidatesTags: ['Subscription', 'Session'],
    }),
  }),
});

export const {
  useGetSubscriptionQuery,
  useGetSubscriptionPlansQuery,
  useVerifyPurchaseMutation,
  useCreateRazorpayOrderMutation,
  useVerifyRazorpayPaymentMutation,
} = subscriptionApi;
