import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { LEGAL_URLS } from '@/config/constants';
import { termsAccepted } from '@/features/settings/store/preferencesSlice';
import type { AuthStackScreenProps } from '@/navigation/types';
import { PrimaryButton, ScreenContainer } from '@/shared/components';
import { useAppDispatch } from '@/store/hooks';
import { colors, fontSize, moderateScale, scale, verticalScale } from '@/theme';

import { LEGAL_SECTIONS, type LegalSectionId } from '../content/legal';

export function TermsScreen({ navigation }: AuthStackScreenProps<'Terms'>) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [activeId, setActiveId] = useState<LegalSectionId>('terms');
  const activeSection = LEGAL_SECTIONS.find(section => section.id === activeId);

  const handleAccept = () => {
    dispatch(termsAccepted());
    navigation.replace('EmailSignIn');
  };

  const openFullDocument = () => {
    Linking.openURL(LEGAL_URLS.terms).catch(() =>
      Alert.alert(t('common.error'), t('terms.openFailed')),
    );
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('terms.title')}</Text>
          <Text style={styles.subtitle}>{t('terms.subtitle')}</Text>
        </View>

        <View style={styles.tabs}>
          {LEGAL_SECTIONS.map(section => {
            const isActive = section.id === activeId;
            return (
              <Pressable
                key={section.id}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                onPress={() => setActiveId(section.id)}
                style={[styles.tab, isActive && styles.tabActive]}
              >
                <Text
                  style={[styles.tabText, isActive && styles.tabTextActive]}
                >
                  {section.tabLabel}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {activeSection ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{activeSection.title}</Text>
            <ScrollView style={styles.sectionBody} nestedScrollEnabled>
              <Text style={styles.bodyText}>{activeSection.body}</Text>
            </ScrollView>
            <Pressable onPress={openFullDocument} hitSlop={8}>
              <Text style={styles.link}>{t('terms.viewFull')}</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.acceptanceText}>{t('terms.acceptance')}</Text>
          <PrimaryButton label={t('terms.accept')} onPress={handleAccept} />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    padding: scale(20),
  },
  header: {
    alignItems: 'center',
    marginVertical: verticalScale(20),
  },
  title: {
    fontSize: fontSize(24),
    color: colors.textPrimary,
    fontWeight: 'bold',
    marginBottom: verticalScale(8),
  },
  subtitle: {
    fontSize: fontSize(14),
    color: colors.textSecondary,
    textAlign: 'center',
  },
  tabs: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: verticalScale(20),
  },
  tab: {
    paddingVertical: verticalScale(8),
    paddingHorizontal: scale(12),
    borderRadius: moderateScale(20),
    backgroundColor: colors.surface,
  },
  tabActive: {
    backgroundColor: colors.buttonPrimary,
  },
  tabText: {
    fontSize: fontSize(12),
    color: colors.textSecondary,
    fontWeight: '500',
  },
  tabTextActive: {
    color: colors.buttonPrimaryText,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: moderateScale(12),
    padding: scale(16),
    marginBottom: verticalScale(16),
  },
  sectionTitle: {
    fontSize: fontSize(18),
    color: colors.textPrimary,
    fontWeight: 'bold',
    marginBottom: verticalScale(16),
    textAlign: 'center',
  },
  sectionBody: {
    maxHeight: verticalScale(250),
  },
  bodyText: {
    fontSize: fontSize(14),
    color: colors.textSecondary,
    lineHeight: verticalScale(20),
  },
  link: {
    marginTop: verticalScale(12),
    color: colors.textPrimary,
    textAlign: 'center',
    textDecorationLine: 'underline',
    fontSize: fontSize(13),
  },
  acceptanceText: {
    fontSize: fontSize(12),
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: verticalScale(16),
    lineHeight: verticalScale(16),
  },
});
