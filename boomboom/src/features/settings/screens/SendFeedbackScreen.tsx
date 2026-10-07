import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { RootStackScreenProps } from '@/navigation/types';
import { Icon, ScreenContainer, type IconName } from '@/shared/components';
import { colors, fontSize, palette } from '@/theme';

import { SettingsPageHeader } from '../components/SettingsPageHeader';

type Props = RootStackScreenProps<'SendFeedback'>;

type Topic = 'bug' | 'suggestion' | 'compliment' | 'other';

const TOPICS: { key: Topic; icon: IconName }[] = [
  { key: 'bug', icon: 'bug-outline' },
  { key: 'suggestion', icon: 'bulb-outline' },
  { key: 'compliment', icon: 'heart-outline' },
  { key: 'other', icon: 'ellipsis-horizontal' },
];

export function SendFeedbackScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [topic, setTopic] = useState<Topic>('suggestion');
  const [message, setMessage] = useState('');

  const submit = () => {
    const body = message.trim();
    if (!body) {
      Alert.alert(t('common.error'), t('settings.feedbackPage.messageRequired'));
      return;
    }
    const subject = t(`settings.feedbackPage.topics.${topic}`);
    Linking.openURL(
      `mailto:support@boomboom.app?subject=${encodeURIComponent(
        `BoomBoom Feedback: ${subject}`,
      )}&body=${encodeURIComponent(body)}`,
    )
      .then(() => navigation.goBack())
      .catch(() => Alert.alert(t('common.error'), t('settings.openFailed')));
  };

  return (
    <ScreenContainer edges={['top']}>
      <SettingsPageHeader
        title={t('settings.feedbackPage.title')}
        onBack={() => navigation.goBack()}
      />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.body}
      >
        <Text style={styles.heading}>{t('settings.feedbackPage.heading')}</Text>
        <Text style={styles.sub}>{t('settings.feedbackPage.sub')}</Text>
        <Text style={styles.label}>{t('settings.feedbackPage.select')}</Text>
        <View style={styles.grid}>
          {TOPICS.map(item => {
            const selected = topic === item.key;
            return (
              <Pressable
                key={item.key}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setTopic(item.key)}
                style={[styles.topic, selected && styles.topicOn]}
              >
                <View
                  style={[styles.topicIcon, selected && styles.topicIconOn]}
                >
                  <Icon
                    name={item.icon}
                    size={20}
                    color={selected ? '#111111' : colors.textSecondary}
                  />
                </View>
                <Text style={[styles.topicText, selected && styles.topicTextOn]}>
                  {t(`settings.feedbackPage.topics.${item.key}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.label}>{t('settings.feedbackPage.message')}</Text>
        <TextInput
          value={message}
          onChangeText={setMessage}
          placeholder={t('settings.feedbackPage.placeholder')}
          placeholderTextColor={colors.textMuted}
          multiline
          textAlignVertical="top"
          style={styles.input}
        />
        <Pressable accessibilityRole="button" onPress={submit} style={styles.cta}>
          <Text style={styles.ctaText}>{t('settings.feedbackPage.submit')}</Text>
          <Icon name="arrow-forward" size={16} color={palette.black} />
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  heading: {
    color: colors.textPrimary,
    fontSize: fontSize(26),
    fontWeight: '800',
    marginBottom: 8,
  },
  sub: {
    color: colors.textSecondary,
    fontSize: fontSize(14),
    lineHeight: 20,
    marginBottom: 22,
  },
  label: {
    color: colors.textPrimary,
    fontSize: fontSize(13),
    fontWeight: '700',
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 22,
  },
  topic: {
    width: '47.5%',
    backgroundColor: '#141414',
    borderRadius: 20,
    paddingVertical: 22,
    alignItems: 'center',
    gap: 12,
  },
  topicOn: {
    backgroundColor: palette.white,
  },
  topicIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1F1F1F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topicIconOn: {
    backgroundColor: '#EFEFEF',
  },
  topicText: {
    color: colors.textPrimary,
    fontSize: fontSize(13),
    fontWeight: '600',
  },
  topicTextOn: {
    color: palette.black,
  },
  input: {
    minHeight: 140,
    backgroundColor: '#141414',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 16,
    color: colors.textPrimary,
    fontSize: fontSize(14),
    marginBottom: 22,
  },
  cta: {
    backgroundColor: palette.white,
    borderRadius: 28,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaText: {
    color: palette.black,
    fontSize: fontSize(15),
    fontWeight: '800',
  },
});
