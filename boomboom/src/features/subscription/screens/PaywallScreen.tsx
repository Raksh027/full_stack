import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { LEGAL_URLS } from '@/config/constants';
import {
  selectSessionUser,
  sessionUserUpdated,
} from '@/features/auth/store/authSlice';
import type { RootStackScreenProps } from '@/navigation/types';
import { Icon, ScreenContainer } from '@/shared/components';
import { showErrorAlert } from '@/shared/utils/alerts';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { colors, fontSize, palette } from '@/theme';

import {
  useCreateRazorpayOrderMutation,
  useGetSubscriptionPlansQuery,
  useGetSubscriptionQuery,
  useVerifyRazorpayPaymentMutation,
  type SubscriptionPlan,
} from '../api/subscriptionApi';
import {
  openRazorpayCheckout,
  RazorpayCheckoutCancelledError,
} from '../razorpayCheckout';

type Props = RootStackScreenProps<'Paywall'>;

const HERO =
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80';
const PURPLE = '#8B5CFF';

const FALLBACK_PLANS: SubscriptionPlan[] = [
  {
    id: 'monthly',
    tier: 'plus',
    storeProductId: 'boomboom_premium_monthly',
    durationMonths: 1,
    displayPrice: '₹499',
  },
  {
    id: 'semiannual',
    tier: 'plus',
    storeProductId: 'boomboom_premium_semiannual',
    durationMonths: 6,
    displayPrice: '₹1,999',
  },
  {
    id: 'yearly',
    tier: 'plus',
    storeProductId: 'boomboom_premium_yearly',
    durationMonths: 12,
    displayPrice: '₹2,999',
  },
];

function planCopy(plan: SubscriptionPlan) {
  const months = plan.durationMonths;
  if (months <= 1) {
    return {
      nameKey: 'standard' as const,
      price: plan.displayPrice || '₹499',
      periodKey: 'monthly' as const,
    };
  }
  if (months <= 6) {
    return {
      nameKey: 'popular' as const,
      price: plan.displayPrice || '₹1,999',
      periodKey: 'sixMonths' as const,
    };
  }
  return {
    nameKey: 'special' as const,
    price: plan.displayPrice || '₹2,999',
    periodKey: 'yearly' as const,
  };
}

export function PaywallScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const session = useAppSelector(selectSessionUser);
  const { data: subscription, refetch } = useGetSubscriptionQuery();
  const { data: remotePlans, isLoading: loadingPlans } =
    useGetSubscriptionPlansQuery();
  const [createOrder, { isLoading: isOrdering }] =
    useCreateRazorpayOrderMutation();
  const [verifyRazorpay, { isLoading: isVerifying }] =
    useVerifyRazorpayPaymentMutation();
  const isBuying = isOrdering || isVerifying;

  const plans = useMemo(() => {
    const items = remotePlans?.length ? remotePlans : FALLBACK_PLANS;
    return items.filter(plan => plan.storeProductId);
  }, [remotePlans]);

  const popularId =
    plans.find(plan => plan.durationMonths > 1 && plan.durationMonths <= 6)?.id ??
    plans[0]?.id ??
    null;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId ?? popularId;
  const premium = Boolean(session?.isPremium || subscription?.tier === 'plus');

  const buy = async () => {
    const plan = plans.find(item => item.id === selected);
    if (!plan || premium) {
      return;
    }
    try {
      const order = await createOrder({ productId: plan.storeProductId }).unwrap();
      const checkout = await openRazorpayCheckout({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: order.name,
        description: order.description,
        order_id: order.orderId,
        mockCheckout: order.mockCheckout,
        prefill: {
          email: order.prefill.email || session?.email || undefined,
          name: order.prefill.name,
        },
        theme: { color: PURPLE },
      });
      const next = await verifyRazorpay({
        productId: plan.storeProductId,
        orderId: checkout.razorpay_order_id || order.orderId,
        paymentId: checkout.razorpay_payment_id,
        signature: checkout.razorpay_signature,
      }).unwrap();
      dispatch(sessionUserUpdated({ isPremium: next.tier !== 'free' }));
      Alert.alert(t('settings.subscription'), t('settings.paywall.active'));
      navigation.goBack();
    } catch (error) {
      if (error instanceof RazorpayCheckoutCancelledError) {
        return;
      }
      showErrorAlert(error);
    }
  };

  const restore = async () => {
    try {
      const result = await refetch();
      if (result.data?.tier && result.data.tier !== 'free') {
        dispatch(sessionUserUpdated({ isPremium: true }));
        Alert.alert(t('settings.paywall.restore'), t('settings.paywall.active'));
      } else {
        Alert.alert(t('settings.paywall.restore'), t('settings.paywall.restoreEmpty'));
      }
    } catch (error) {
      showErrorAlert(error);
    }
  };

  const openLegal = (url: string) => {
    Linking.openURL(url).catch(() =>
      Alert.alert(t('common.error'), t('settings.openFailed')),
    );
  };

  return (
    <ScreenContainer edges={['bottom']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <View>
          <Image source={{ uri: HERO }} style={styles.hero} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            onPress={() => navigation.goBack()}
            style={styles.heroBack}
          >
            <Icon name="chevron-back" size={22} color={palette.white} />
          </Pressable>
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>{t('settings.paywall.title')}</Text>
          <Text style={styles.lead}>{t('settings.paywall.lead')}</Text>
        </View>

        {loadingPlans ? (
          <ActivityIndicator color={colors.textPrimary} style={styles.loader} />
        ) : (
          <View style={styles.plans}>
            {plans.map(plan => {
              const meta = planCopy(plan);
              const isSelected = plan.id === selected;
              const isPopular = meta.nameKey === 'popular';
              return (
                <Pressable
                  key={plan.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => setSelectedId(plan.id)}
                  style={[
                    styles.plan,
                    isSelected && styles.planOn,
                  ]}
                >
                  <View style={[styles.radio, isSelected && styles.radioOn]}>
                    {isSelected ? <View style={styles.radioDot} /> : null}
                  </View>
                  <Text style={styles.planName}>
                    {t(`settings.paywall.names.${meta.nameKey}`)}
                  </Text>
                  {isPopular ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {t('settings.paywall.names.popular')}
                      </Text>
                    </View>
                  ) : null}
                  <Text style={styles.planPrice}>
                    {meta.price} / {t(`settings.paywall.periods.${meta.periodKey}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <Text style={styles.legal}>{t('settings.paywall.autoRenew')}</Text>
        <Pressable
          accessibilityRole="button"
          disabled={isBuying || premium || !selected}
          onPress={buy}
          style={[styles.cta, (isBuying || premium) && styles.ctaDisabled]}
        >
          {isBuying ? (
            <ActivityIndicator color={palette.white} />
          ) : (
            <Text style={styles.ctaText}>
              {premium
                ? t('settings.paywall.current')
                : t('settings.paywall.subscribe')}
            </Text>
          )}
        </Pressable>
        <View style={styles.footer}>
          <Pressable onPress={restore}>
            <Text style={styles.footerLink}>{t('settings.paywall.restore')}</Text>
          </Pressable>
          <Text style={styles.footerDot}>·</Text>
          <Pressable onPress={() => openLegal(LEGAL_URLS.privacy)}>
            <Text style={styles.footerLink}>{t('settings.privacy')}</Text>
          </Pressable>
          <Text style={styles.footerDot}>·</Text>
          <Pressable onPress={() => openLegal(LEGAL_URLS.terms)}>
            <Text style={styles.footerLink}>{t('settings.paywall.termsOfUse')}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: 28,
  },
  hero: {
    width: '100%',
    height: 280,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    backgroundColor: '#1A1A1A',
  },
  heroBack: {
    position: 'absolute',
    top: 54,
    left: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    paddingHorizontal: 22,
    paddingTop: 22,
    gap: 8,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSize(28),
    fontWeight: '800',
  },
  lead: {
    color: colors.textSecondary,
    fontSize: fontSize(14),
    lineHeight: 21,
  },
  loader: {
    marginTop: 24,
  },
  plans: {
    paddingHorizontal: 16,
    paddingTop: 22,
    gap: 10,
  },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141414',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  planOn: {
    borderColor: PURPLE,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#6A6A6A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: {
    borderColor: PURPLE,
  },
  radioDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: PURPLE,
  },
  planName: {
    color: colors.textPrimary,
    fontSize: fontSize(15),
    fontWeight: '700',
  },
  badge: {
    backgroundColor: PURPLE,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    color: palette.white,
    fontSize: fontSize(10),
    fontWeight: '800',
  },
  planPrice: {
    marginLeft: 'auto',
    color: colors.textSecondary,
    fontSize: fontSize(13),
    fontWeight: '600',
  },
  legal: {
    color: colors.textMuted,
    fontSize: fontSize(12),
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 28,
    marginTop: 16,
    marginBottom: 16,
  },
  cta: {
    marginHorizontal: 16,
    height: 54,
    borderRadius: 28,
    backgroundColor: PURPLE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: {
    opacity: 0.6,
  },
  ctaText: {
    color: palette.white,
    fontSize: fontSize(15),
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
  },
  footerLink: {
    color: colors.textMuted,
    fontSize: fontSize(12),
  },
  footerDot: {
    color: colors.textMuted,
    fontSize: fontSize(12),
  },
});
