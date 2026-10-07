import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import type { RootStackScreenProps } from '@/navigation/types';
import { Icon, ScreenContainer, type IconName } from '@/shared/components';
import { colors, fontSize, palette } from '@/theme';

import {
  useGetNotificationSettingsQuery,
  useUpdateNotificationSettingsMutation,
} from '../api/settingsApi';
import type { NotificationSettings } from '../types';

type Props = RootStackScreenProps<'NotificationSettings'>;

type SettingKey = keyof NotificationSettings;

type RowConfig = {
  key: SettingKey;
  icon: IconName;
  iconColor: string;
  titleKey:
    | 'settings.notificationSettings.all'
    | 'settings.notificationSettings.messages'
    | 'settings.notificationSettings.matches'
    | 'settings.notificationSettings.likes'
    | 'settings.notificationSettings.views'
    | 'settings.notificationSettings.crossPath'
    | 'settings.notificationSettings.traveller'
    | 'settings.notificationSettings.freeTonight'
    | 'settings.notificationSettings.email';
  hintKey:
    | 'settings.notificationSettings.allHint'
    | 'settings.notificationSettings.messagesHint'
    | 'settings.notificationSettings.matchesHint'
    | 'settings.notificationSettings.likesHint'
    | 'settings.notificationSettings.viewsHint'
    | 'settings.notificationSettings.crossPathHint'
    | 'settings.notificationSettings.travellerHint'
    | 'settings.notificationSettings.freeTonightHint'
    | 'settings.notificationSettings.emailHint';
};

const SWITCH_ON = '#F5C400';
const SWITCH_OFF = '#3A3A42';
const CARD_BG = '#121826';
const ICON_BLUE = '#3B82F6';

const DEFAULTS: NotificationSettings = {
  all: true,
  messages: true,
  matches: true,
  likes: true,
  profileViews: true,
  crossPath: true,
  travellerAlerts: true,
  freeTonight: true,
  email: true,
};

const ROWS: RowConfig[] = [
  {
    key: 'all',
    icon: 'notifications-outline',
    iconColor: '#F5C400',
    titleKey: 'settings.notificationSettings.all',
    hintKey: 'settings.notificationSettings.allHint',
  },
  {
    key: 'messages',
    icon: 'chatbubble-outline',
    iconColor: ICON_BLUE,
    titleKey: 'settings.notificationSettings.messages',
    hintKey: 'settings.notificationSettings.messagesHint',
  },
  {
    key: 'matches',
    icon: 'heart-outline',
    iconColor: ICON_BLUE,
    titleKey: 'settings.notificationSettings.matches',
    hintKey: 'settings.notificationSettings.matchesHint',
  },
  {
    key: 'likes',
    icon: 'thumbs-up-outline',
    iconColor: ICON_BLUE,
    titleKey: 'settings.notificationSettings.likes',
    hintKey: 'settings.notificationSettings.likesHint',
  },
  {
    key: 'profileViews',
    icon: 'eye-outline',
    iconColor: ICON_BLUE,
    titleKey: 'settings.notificationSettings.views',
    hintKey: 'settings.notificationSettings.viewsHint',
  },
  {
    key: 'crossPath',
    icon: 'git-compare-outline',
    iconColor: ICON_BLUE,
    titleKey: 'settings.notificationSettings.crossPath',
    hintKey: 'settings.notificationSettings.crossPathHint',
  },
  {
    key: 'travellerAlerts',
    icon: 'airplane-outline',
    iconColor: ICON_BLUE,
    titleKey: 'settings.notificationSettings.traveller',
    hintKey: 'settings.notificationSettings.travellerHint',
  },
  {
    key: 'freeTonight',
    icon: 'flame-outline',
    iconColor: ICON_BLUE,
    titleKey: 'settings.notificationSettings.freeTonight',
    hintKey: 'settings.notificationSettings.freeTonightHint',
  },
  {
    key: 'email',
    icon: 'mail-outline',
    iconColor: ICON_BLUE,
    titleKey: 'settings.notificationSettings.email',
    hintKey: 'settings.notificationSettings.emailHint',
  },
];

const CHILD_KEYS: SettingKey[] = ROWS.map(row => row.key).filter(
  key => key !== 'all',
);

export function NotificationSettingsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { data } = useGetNotificationSettingsQuery();
  const [updateSettings] = useUpdateNotificationSettingsMutation();
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULTS);

  useEffect(() => {
    if (data) {
      setSettings({ ...DEFAULTS, ...data });
    }
  }, [data]);

  const setValue = (key: SettingKey, value: boolean) => {
    const next: NotificationSettings =
      key === 'all'
        ? {
            all: value,
            messages: value,
            matches: value,
            likes: value,
            profileViews: value,
            crossPath: value,
            travellerAlerts: value,
            freeTonight: value,
            email: value,
          }
        : {
            ...settings,
            [key]: value,
            all: CHILD_KEYS.every(child =>
              child === key ? value : settings[child],
            ),
          };

    setSettings(next);
    updateSettings(next);
  };

  return (
    <ScreenContainer edges={['top']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          onPress={() => navigation.goBack()}
          style={styles.back}
        >
          <Icon name="chevron-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>{t('settings.notificationSettings.title')}</Text>
          <Text style={styles.subtitle}>
            {t('settings.notificationSettings.subtitle')}
          </Text>
        </View>
        <View style={styles.backSpacer} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
      >
        {ROWS.map(row => {
          const enabled = settings[row.key];
          return (
            <Pressable
              key={row.key}
              accessibilityRole="switch"
              accessibilityState={{ checked: enabled }}
              onPress={() => setValue(row.key, !enabled)}
              style={styles.card}
            >
              <Icon name={row.icon} size={22} color={row.iconColor} />
              <View style={styles.copy}>
                <Text style={styles.cardTitle}>{t(row.titleKey)}</Text>
                <Text style={styles.cardHint}>{t(row.hintKey)}</Text>
              </View>
              <Switch
                value={enabled}
                onValueChange={value => setValue(row.key, value)}
                trackColor={{ false: SWITCH_OFF, true: SWITCH_ON }}
                thumbColor={palette.white}
                ios_backgroundColor={SWITCH_OFF}
                pointerEvents="none"
              />
            </Pressable>
          );
        })}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
    paddingBottom: 14,
    gap: 8,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: palette.gray850,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  backSpacer: {
    width: 40,
  },
  headerCopy: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 4,
    gap: 6,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSize(20),
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: fontSize(13),
    textAlign: 'center',
    lineHeight: 18,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: CARD_BG,
  },
  copy: {
    flex: 1,
    gap: 3,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: fontSize(15),
    fontWeight: '700',
  },
  cardHint: {
    color: colors.textSecondary,
    fontSize: fontSize(12),
    lineHeight: 16,
  },
});
