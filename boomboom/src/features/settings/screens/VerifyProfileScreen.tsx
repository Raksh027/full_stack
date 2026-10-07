import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { launchCamera } from 'react-native-image-picker';

import type { RootStackScreenProps } from '@/navigation/types';
import { uploadToPresignedUrl } from '@/services/media/uploadToPresignedUrl';
import { Icon, ScreenContainer, type IconName } from '@/shared/components';
import { showErrorAlert } from '@/shared/utils/alerts';
import { colors, fontSize, palette } from '@/theme';

import {
  useRequestVerificationUploadMutation,
  useStartVerificationMutation,
  useSubmitVerificationMutation,
} from '../api/settingsApi';

type Props = RootStackScreenProps<'VerifyProfile'>;

const ACCENT = '#7C4DFF';
const TIP_CARD_BG = '#1A1428';
const RING = '#3D2A6E';

type Tip = {
  icon: IconName;
  titleKey:
    | 'settings.verify.tipLightingTitle'
    | 'settings.verify.tipFaceTitle'
    | 'settings.verify.tipCameraTitle';
  hintKey:
    | 'settings.verify.tipLightingHint'
    | 'settings.verify.tipFaceHint'
    | 'settings.verify.tipCameraHint';
};

const TIPS: Tip[] = [
  {
    icon: 'sunny',
    titleKey: 'settings.verify.tipLightingTitle',
    hintKey: 'settings.verify.tipLightingHint',
  },
  {
    icon: 'person',
    titleKey: 'settings.verify.tipFaceTitle',
    hintKey: 'settings.verify.tipFaceHint',
  },
  {
    icon: 'eye',
    titleKey: 'settings.verify.tipCameraTitle',
    hintKey: 'settings.verify.tipCameraHint',
  },
];

export function VerifyProfileScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [capturing, setCapturing] = useState(false);
  const [startVerification] = useStartVerificationMutation();
  const [requestUpload] = useRequestVerificationUploadMutation();
  const [submitVerification] = useSubmitVerificationMutation();

  const takeSelfie = async () => {
    if (capturing) {
      return;
    }
    setCapturing(true);
    try {
      const response = await launchCamera({
        mediaType: 'photo',
        cameraType: 'front',
        quality: 0.85,
        maxWidth: 1280,
        maxHeight: 1280,
        saveToPhotos: false,
      });

      if (response.didCancel) {
        return;
      }
      if (response.errorCode) {
        throw new Error(response.errorMessage ?? response.errorCode);
      }
      const asset = response.assets?.[0];
      if (!asset?.uri) {
        return;
      }

      await startVerification().unwrap();
      const contentType = asset.type ?? 'image/jpeg';
      const ticket = await requestUpload({
        contentType,
        filename: asset.fileName ?? 'selfie.jpg',
        byteSize: Math.max(asset.fileSize ?? 0, 1),
      }).unwrap();
      await uploadToPresignedUrl({
        uploadUrl: ticket.uploadUrl,
        fileUri: asset.uri,
        contentType,
        headers: ticket.headers,
      });
      await submitVerification({ storageKey: ticket.storageKey }).unwrap();

      Alert.alert(
        t('settings.verify.submittedTitle'),
        t('settings.verify.submittedMessage'),
        [{ text: t('common.ok'), onPress: () => navigation.goBack() }],
      );
    } catch (error) {
      showErrorAlert(error);
    } finally {
      setCapturing(false);
    }
  };

  return (
    <ScreenContainer edges={['top', 'bottom']} style={styles.container}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          onPress={() => navigation.goBack()}
          hitSlop={8}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
        >
          <Icon name="chevron-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('settings.verify.title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroIcon}>
          <Icon name="shield-checkmark" size={42} color={palette.white} />
        </View>

        <Text style={styles.title}>{t('settings.verify.heading')}</Text>
        <Text style={styles.subtitle}>{t('settings.verify.subtitle')}</Text>

        <View style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>{t('settings.verify.tipsTitle')}</Text>
          {TIPS.map(tip => (
            <View key={tip.titleKey} style={styles.tipRow}>
              <View style={styles.tipIcon}>
                <Icon name={tip.icon} size={18} color={palette.white} />
              </View>
              <View style={styles.tipCopy}>
                <Text style={styles.tipTitle}>{t(tip.titleKey)}</Text>
                <Text style={styles.tipHint}>{t(tip.hintKey)}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.captureBlock}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('settings.verify.tapCta')}
            onPress={takeSelfie}
            disabled={capturing}
            style={({ pressed }) => [
              styles.captureOuter,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.captureRing}>
              <View style={styles.captureBtn}>
                {capturing ? (
                  <ActivityIndicator color={palette.white} />
                ) : (
                  <Icon name="camera" size={34} color={palette.white} />
                )}
              </View>
            </View>
          </Pressable>
          <Text style={styles.tapLabel}>{t('settings.verify.tapCta')}</Text>
        </View>

        <Text style={styles.footer}>{t('settings.verify.reviewHint')}</Text>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.gray850,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: colors.textPrimary,
    fontSize: fontSize(17),
    fontWeight: '700',
  },
  headerSpacer: {
    width: 40,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingBottom: 28,
    alignItems: 'center',
  },
  heroIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    marginBottom: 22,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSize(28),
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  subtitle: {
    marginTop: 10,
    marginBottom: 24,
    color: colors.textSecondary,
    fontSize: fontSize(15),
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  tipsCard: {
    alignSelf: 'stretch',
    backgroundColor: TIP_CARD_BG,
    borderRadius: 20,
    padding: 18,
    gap: 16,
    borderWidth: 1,
    borderColor: '#2A2040',
  },
  tipsTitle: {
    color: colors.textPrimary,
    fontSize: fontSize(16),
    fontWeight: '700',
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  tipIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipCopy: {
    flex: 1,
    gap: 2,
  },
  tipTitle: {
    color: colors.textPrimary,
    fontSize: fontSize(15),
    fontWeight: '700',
  },
  tipHint: {
    color: colors.textSecondary,
    fontSize: fontSize(13),
  },
  captureBlock: {
    alignItems: 'center',
    marginTop: 36,
    gap: 14,
  },
  captureOuter: {
    padding: 10,
  },
  captureRing: {
    width: 118,
    height: 118,
    borderRadius: 59,
    borderWidth: 2,
    borderColor: RING,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureBtn: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tapLabel: {
    color: colors.textPrimary,
    fontSize: fontSize(16),
    fontWeight: '700',
  },
  footer: {
    marginTop: 28,
    color: colors.textMuted,
    fontSize: fontSize(12),
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  pressed: {
    opacity: 0.85,
  },
});
