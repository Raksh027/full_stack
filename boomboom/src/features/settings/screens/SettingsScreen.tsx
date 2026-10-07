import { useTranslation } from 'react-i18next';
import {
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { images } from '@/assets';
import { LEGAL_URLS } from '@/config/constants';
import {
  selectIsSigningOut,
  selectSessionUser,
} from '@/features/auth/store/authSlice';
import { signOut } from '@/features/auth/store/authThunks';
import { useGetMyProfileQuery } from '@/features/profile/api/profileApi';
import type { RootStackScreenProps } from '@/navigation/types';
import { Icon, ScreenContainer } from '@/shared/components';
import { showErrorAlert } from '@/shared/utils/alerts';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { colors, fontSize, palette } from '@/theme';

import {
  useGetDiscoveryPreferencesQuery,
  useGetNotificationSettingsQuery,
  useUpdateDiscoveryPreferencesMutation,
  useUpdateNotificationSettingsMutation,
} from '../api/settingsApi';
import { SettingsRow } from '../components/SettingsRow';
import {
  crossPathToggled,
  selectCrossPathEnabled,
} from '../store/preferencesSlice';

type Props = RootStackScreenProps<'Settings'>;

const UPGRADE_FILL = ['#8B5CFF', '#3DB4FF'] as const;
const GOLD = '#F5C400';
/** Same outline as DOB year / month / day selected cells. */
const CARD_BORDER = colors.gradientBorder[0];
const GROUP_BORDER = '#3A3A3A';

const STORE_URL = Platform.select({
  ios: 'https://apps.apple.com/app/boomboom',
  android: 'market://details?id=com.boomboom',
  default: 'https://www.boomboom.com',
});

export function SettingsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const session = useAppSelector(selectSessionUser);
  const isSigningOut = useAppSelector(selectIsSigningOut);
  const crossPathLocal = useAppSelector(selectCrossPathEnabled);
  const { data: me } = useGetMyProfileQuery();
  const { data: discoveryPrefs } = useGetDiscoveryPreferencesQuery();
  const { data: notificationSettings } = useGetNotificationSettingsQuery();
  const [updateDiscoveryPrefs] = useUpdateDiscoveryPreferencesMutation();
  const [updateNotificationSettings] = useUpdateNotificationSettingsMutation();
  const crossPathEnabled = notificationSettings?.crossPath ?? crossPathLocal;

  const photo = me?.photos?.[0]?.url;
  const premium = Boolean(session?.isPremium);
  const displayName = me?.name?.trim() || t('settings.yourProfile');
  const ghostMode = discoveryPrefs ? !discoveryPrefs.isDiscoverable : false;

  const openLink = (url: string) => {
    Linking.openURL(url).catch(() =>
      Alert.alert(t('common.error'), t('settings.openFailed')),
    );
  };

  const confirmSignOut = () => {
    Alert.alert(t('settings.signOut'), t('settings.signOutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.logout'),
        style: 'destructive',
        onPress: () => {
          void dispatch(signOut());
        },
      },
    ]);
  };

  const shareApp = async () => {
    try {
      await Share.share({
        message: t('settings.shareMessage'),
        url: 'https://www.boomboom.com',
      });
    } catch {
      // User dismissed share sheet.
    }
  };

  return (
    <ScreenContainer edges={['top']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => navigation.goBack()}
          style={styles.back}
        >
          <Icon name="chevron-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('settings.title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <View style={styles.profileCard}>
          <View style={styles.avatarBlock}>
            <View style={styles.avatarRing}>
              {photo ? (
                <Image source={{ uri: photo }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Image
                    source={images.profilePlaceholder}
                    style={styles.avatarPlaceholder}
                  />
                </View>
              )}
            </View>
            <View
              style={[
                styles.planBadge,
                premium ? styles.planBadgePremium : styles.planBadgeFree,
              ]}
            >
              <Text
                style={[
                  styles.planBadgeText,
                  premium
                    ? styles.planBadgeTextPremium
                    : styles.planBadgeTextFree,
                ]}
              >
                {premium
                  ? t('settings.premiumBadge')
                  : t('settings.freeBadge')}
              </Text>
            </View>
          </View>

          <Text style={styles.name} numberOfLines={1}>
            {displayName}
          </Text>
          {session?.email ? (
            <Text style={styles.email} numberOfLines={1}>
              {session.email}
            </Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('Paywall')}
            style={styles.upgradeOutline}
          >
            <Icon name="ribbon" size={16} color={GOLD} />
            <Text style={styles.upgradeOutlineLabel}>
              {t('settings.upgrade')}
            </Text>
          </Pressable>
        </View>

        <View style={styles.sectionHeaderRow}>
          <Icon name="star" size={12} color="#E14BFF" />
          <Text style={styles.sectionHeader}>{t('settings.spotlight')}</Text>
        </View>
        <View style={styles.spotlightCard}>
          <View style={styles.spotlightTop}>
            <View style={styles.spotlightIcon}>
              <Icon name="star" size={18} color="#C084FC" />
            </View>
            <View style={styles.spotlightCopy}>
              <Text style={styles.spotlightTitle}>
                {t('settings.spotlightTitle')}
              </Text>
              <Text style={styles.spotlightHint}>
                {t('settings.spotlightHint')}
              </Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('Paywall')}
          >
            <LinearGradient
              colors={[...UPGRADE_FILL]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.upgradeFill}
            >
              <Text style={styles.upgradeFillLabel}>
                {t('settings.upgrade')}
              </Text>
              <Icon name="ribbon" size={15} color={palette.white} />
            </LinearGradient>
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>{t('settings.account')}</Text>
        <View style={styles.group}>
          <SettingsRow
            icon="person"
            iconColor="#60A5FA"
            title={t('settings.viewProfile')}
            hint={t('settings.viewProfileHint')}
            onPress={() => {
              if (me?.id) {
                navigation.navigate('UserProfile', { userId: me.id });
              }
            }}
          />
          <SettingsRow
            icon="checkmark-circle"
            iconColor="#4CD964"
            title={t('settings.verifyProfile')}
            hint={t('settings.verifyProfileHint')}
            onPress={() => {
              if (me?.isVerified) {
                Alert.alert(
                  t('settings.verifyProfile'),
                  t('settings.verifyDone'),
                );
                return;
              }
              navigation.navigate('VerifyProfile');
            }}
          />
          <SettingsRow
            icon="create"
            iconColor="#FBBF24"
            title={t('settings.editProfile')}
            hint={t('settings.editProfileHint')}
            onPress={() => navigation.navigate('EditProfile')}
          />
          <SettingsRow
            icon="star"
            iconColor="#F5C400"
            title={t('settings.subscription')}
            hint={t('settings.subscriptionHint')}
            badge={t(premium ? 'settings.premium' : 'settings.free')}
            badgeTone={premium ? 'premium' : 'free'}
            onPress={() => navigation.navigate('Paywall')}
          />
          <SettingsRow
            icon="ban"
            iconColor="#F87171"
            title={t('settings.blocked')}
            hint={t('settings.blockedHint')}
            last
            onPress={() => navigation.navigate('BlockedUsers')}
          />
        </View>

        <Text style={styles.sectionLabel}>{t('settings.about')}</Text>
        <View style={styles.group}>
          <SettingsRow
            icon="document-text"
            iconColor="#A78BFA"
            title={t('settings.terms')}
            hint={t('settings.termsHint')}
            onPress={() => openLink(LEGAL_URLS.terms)}
          />
          <SettingsRow
            icon="lock-closed"
            iconColor="#60A5FA"
            title={t('settings.privacy')}
            hint={t('settings.privacyHint')}
            onPress={() => openLink(LEGAL_URLS.privacy)}
          />
          <SettingsRow
            icon="headset"
            iconColor="#2DD4BF"
            title={t('settings.help')}
            hint={t('settings.helpHint')}
            onPress={() => navigation.navigate('HelpSupport')}
          />
          <SettingsRow
            icon="star"
            iconColor="#FBBF24"
            title={t('settings.rateUs')}
            hint={t('settings.rateUsHint')}
            onPress={() => openLink(STORE_URL)}
          />
          <SettingsRow
            icon="chatbubble-ellipses"
            iconColor="#F472B6"
            title={t('settings.feedback')}
            hint={t('settings.feedbackHint')}
            onPress={() => navigation.navigate('SendFeedback')}
          />
          <SettingsRow
            icon="notifications"
            iconColor="#E879F9"
            title={t('settings.notification')}
            hint={t('settings.notificationHint')}
            onPress={() => navigation.navigate('NotificationSettings')}
          />
          <SettingsRow
            icon="eye-off"
            iconColor="#C4B5FD"
            title={t('settings.ghostMode')}
            hint={t('settings.ghostModeHint')}
            switchValue={ghostMode}
            onSwitchChange={value => {
              updateDiscoveryPrefs({ isDiscoverable: !value })
                .unwrap()
                .catch(showErrorAlert);
            }}
          />
          <SettingsRow
            icon="git-merge"
            iconColor="#4ADE80"
            title={t('settings.crossPath')}
            hint={t('settings.crossPathHint')}
            switchValue={crossPathEnabled}
            onSwitchChange={value => {
              dispatch(crossPathToggled(value));
              updateNotificationSettings({ crossPath: value })
                .unwrap()
                .catch(error => {
                  dispatch(crossPathToggled(!value));
                  showErrorAlert(error);
                });
            }}
          />
          <SettingsRow
            icon="share-social"
            iconColor="#38BDF8"
            title={t('settings.shareApp')}
            hint={t('settings.shareAppHint')}
            onPress={shareApp}
          />
          <SettingsRow
            icon="log-out"
            iconColor="#F87171"
            title={t('settings.logout')}
            hint={t('settings.logoutHint')}
            onPress={isSigningOut ? undefined : confirmSignOut}
          />
          <SettingsRow
            icon="trash"
            iconColor="#FB7185"
            title={t('settings.deleteAccount.title')}
            hint={t('settings.deleteAccount.hint')}
            last
            onPress={() => navigation.navigate('DeleteAccount')}
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
    paddingTop: 4,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#1A1A1F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: colors.textPrimary,
    fontSize: fontSize(22),
    fontWeight: '800',
  },
  headerSpacer: {
    width: 40,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
    gap: 14,
  },
  profileCard: {
    backgroundColor: '#101820',
    alignItems: 'center',
    paddingTop: 22,
    paddingBottom: 18,
    paddingHorizontal: 20,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: CARD_BORDER,
  },
  avatarBlock: {
    alignItems: 'center',
    marginBottom: 14,
  },
  avatarRing: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 3,
    borderColor: CARD_BORDER,
    overflow: 'hidden',
    backgroundColor: '#1C1C1C',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    tintColor: colors.textMuted,
    resizeMode: 'contain',
  },
  planBadge: {
    position: 'absolute',
    bottom: -6,
    paddingHorizontal: 10,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planBadgePremium: {
    backgroundColor: GOLD,
  },
  planBadgeFree: {
    backgroundColor: '#1C1C1C',
    borderWidth: 1,
    borderColor: palette.gray650,
  },
  planBadgeText: {
    fontSize: fontSize(10),
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  planBadgeTextPremium: {
    color: palette.black,
  },
  planBadgeTextFree: {
    color: colors.textSecondary,
  },
  name: {
    color: colors.textPrimary,
    fontSize: fontSize(22),
    fontWeight: '800',
    textAlign: 'center',
  },
  email: {
    marginTop: 4,
    color: colors.textSecondary,
    fontSize: fontSize(13),
    textAlign: 'center',
  },
  upgradeOutline: {
    marginTop: 16,
    alignSelf: 'stretch',
    height: 46,
    borderRadius: 23,
    borderWidth: 1.5,
    borderColor: GOLD,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'transparent',
  },
  upgradeOutlineLabel: {
    color: GOLD,
    fontSize: fontSize(15),
    fontWeight: '700',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    marginLeft: 4,
  },
  sectionHeader: {
    color: colors.textMuted,
    fontSize: fontSize(12),
    fontWeight: '800',
    letterSpacing: 1,
  },
  spotlightCard: {
    backgroundColor: '#101820',
    padding: 14,
    gap: 14,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: CARD_BORDER,
  },
  spotlightTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  spotlightIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: CARD_BORDER,
    backgroundColor: 'rgba(58,160,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotlightCopy: {
    flex: 1,
    gap: 4,
    paddingTop: 2,
  },
  spotlightTitle: {
    color: colors.textPrimary,
    fontSize: fontSize(16),
    fontWeight: '800',
  },
  spotlightHint: {
    color: colors.textSecondary,
    fontSize: fontSize(12),
    lineHeight: 17,
  },
  upgradeFill: {
    height: 44,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  upgradeFillLabel: {
    color: palette.white,
    fontSize: fontSize(14),
    fontWeight: '700',
  },
  sectionLabel: {
    marginTop: 4,
    marginLeft: 4,
    color: colors.textMuted,
    fontSize: fontSize(12),
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  group: {
    backgroundColor: '#101820',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: GROUP_BORDER,
  },
});
