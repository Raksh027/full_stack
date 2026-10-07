import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { RootStackScreenProps } from '@/navigation/types';
import { Icon, ScreenContainer } from '@/shared/components';
import { showErrorAlert } from '@/shared/utils/alerts';
import { colors, fontSize } from '@/theme';

import {
  useReportUserMutation,
  type ReportReason,
} from '../api/safetyApi';

type Props = RootStackScreenProps<'Report'>;

const REASONS: ReportReason[] = [
  'fake_profile',
  'inappropriate_content',
  'spam',
];

export function ReportScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const [reportUser, { isLoading }] = useReportUserMutation();

  const submit = async (reason: ReportReason) => {
    try {
      await reportUser({ userId: route.params.userId, reason }).unwrap();
      Alert.alert(t('boom.report'), t('boom.reportSent'));
      navigation.goBack();
    } catch (error) {
      showErrorAlert(error);
    }
  };

  return (
    <ScreenContainer edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back}>
          <Icon name="close" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>{t('boom.report')}</Text>
        <View style={styles.back} />
      </View>
      {REASONS.map(reason => (
        <Pressable
          key={reason}
          disabled={isLoading}
          onPress={() => submit(reason)}
          style={styles.row}
        >
          <Text style={styles.rowLabel}>
            {reason === 'fake_profile'
              ? t('boom.fakeProfile')
              : reason === 'inappropriate_content'
                ? t('boom.inappropriate')
                : t('boom.spam')}
          </Text>
        </Pressable>
      ))}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 12,
  },
  back: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    color: colors.textPrimary,
    fontSize: fontSize(18),
    fontWeight: '800',
  },
  row: {
    marginHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2A2A32',
  },
  rowLabel: {
    color: colors.textPrimary,
    fontSize: fontSize(15),
    fontWeight: '600',
  },
});
