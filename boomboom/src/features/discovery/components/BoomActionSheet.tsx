import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import type { DiscoveryCandidate } from '@/features/discovery/types';
import type { ReportReason } from '@/features/safety/api/safetyApi';
import { Icon } from '@/shared/components';
import { colors, fontSize, palette } from '@/theme';

type Props = {
  visible: boolean;
  profile: DiscoveryCandidate | null;
  onClose: () => void;
  onBlock: () => void;
  onReport: (reason: ReportReason) => void;
};

export function BoomActionSheet({
  visible,
  profile,
  onClose,
  onBlock,
  onReport,
}: Props) {
  const { t } = useTranslation();
  if (!profile) {
    return null;
  }

  const initials = profile.name
    .split(' ')
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toLowerCase();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <View style={styles.handle} />
          <Text style={styles.kicker}>{t('boom.moreOptions')}</Text>

          <View style={styles.person}>
            <View style={styles.avatar}>
              <Text style={styles.initials}>{initials}</Text>
            </View>
            <View style={styles.personCopy}>
              <Text style={styles.personName}>
                {profile.name},{profile.age}
              </Text>
              <Text style={styles.personMeta}>
                {t('boom.notSpecified')} · {profile.distanceKm ?? 0} km
              </Text>
            </View>
          </View>

          <Text style={styles.kicker}>{t('boom.actions')}</Text>

          <Pressable style={styles.row} onPress={onBlock}>
            <View style={[styles.icon, { backgroundColor: '#3A1010' }]}>
              <Icon name="ban" size={16} color={colors.danger} />
            </View>
            <View style={styles.rowCopy}>
              <Text style={[styles.rowTitle, { color: colors.danger }]}>
                {t('boom.blockUser')}
              </Text>
              <Text style={styles.rowHint}>{t('boom.blockHint')}</Text>
            </View>
            <Icon name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>

          <Pressable style={styles.row} onPress={() => onReport('fake_profile')}>
            <View style={[styles.icon, { backgroundColor: '#3A2A10' }]}>
              <Icon name="stop" size={16} color="#F5A623" />
            </View>
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>{t('boom.fakeProfile')}</Text>
              <Text style={styles.rowHint}>{t('boom.fakeHint')}</Text>
            </View>
            <Icon name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>

          <Pressable
            style={styles.row}
            onPress={() => onReport('inappropriate_content')}
          >
            <View style={[styles.icon, { backgroundColor: '#2A2410' }]}>
              <Icon name="stop" size={16} color="#C9A227" />
            </View>
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>{t('boom.inappropriate')}</Text>
              <Text style={styles.rowHint}>{t('boom.inappropriateHint')}</Text>
            </View>
            <Icon name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>

          <Pressable style={styles.row} onPress={() => onReport('spam')}>
            <View style={[styles.icon, { backgroundColor: '#24103A' }]}>
              <Icon name="stop" size={16} color="#8B5CF6" />
            </View>
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>{t('boom.spam')}</Text>
              <Text style={styles.rowHint}>{t('boom.spamHint')}</Text>
            </View>
            <Icon name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>

          <Pressable style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelLabel}>{t('boom.cancel')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: '#111111',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 20,
    gap: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.gray650,
    marginBottom: 6,
  },
  kicker: {
    color: colors.textMuted,
    fontSize: fontSize(11),
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 4,
  },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 18,
    backgroundColor: palette.gray900,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#6E5CFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  personCopy: {
    flex: 1,
    gap: 2,
  },
  personName: {
    color: colors.textPrimary,
    fontSize: fontSize(15),
    fontWeight: '700',
  },
  personMeta: {
    color: colors.textMuted,
    fontSize: fontSize(12),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: palette.gray900,
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCopy: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    color: colors.textPrimary,
    fontSize: fontSize(15),
    fontWeight: '700',
  },
  rowHint: {
    color: colors.textMuted,
    fontSize: fontSize(12),
  },
  cancel: {
    height: 48,
    borderRadius: 24,
    backgroundColor: palette.gray850,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  cancelLabel: {
    color: colors.textPrimary,
    fontSize: fontSize(16),
    fontWeight: '700',
  },
});
