import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  ImageBackground,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { selectSessionUser } from '@/features/auth/store/authSlice';
import {
  useSendMessageMutation,
  useStartConversationMutation,
} from '@/features/chat/api/chatApi';
import { QuickReplies } from '@/features/chat/components/QuickReplies';
import { LikeSentBanner } from '@/features/chat/components/LikeSentBanner';
import type { DiscoveryCandidate } from '@/features/discovery/types';
import { Icon } from '@/shared/components';
import { showErrorAlert } from '@/shared/utils/alerts';
import { createClientId } from '@/shared/utils/id';
import { profileFlagUrl } from '@/shared/utils/profileFlag';
import { useAppSelector } from '@/store/hooks';
import { colors, fontSize, palette, screen } from '@/theme';

import { homeAccent } from '../theme';

const FREE_MSG_LIMIT = 3;

type Props = {
  visible: boolean;
  profile: DiscoveryCandidate | null;
  onClose: () => void;
  onBlock: () => void;
  onReport: () => void;
  onFirstMessage?: () => void;
};

export function BoomChatSheet({
  visible,
  profile,
  onClose,
  onBlock,
  onReport,
  onFirstMessage,
}: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const me = useAppSelector(selectSessionUser);
  const threadRef = useRef<ScrollView>(null);
  const [draft, setDraft] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [sent, setSent] = useState<string[]>([]);
  const [likeSent, setLikeSent] = useState(false);
  const [hideFirstBanner, setHideFirstBanner] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [startConversation] = useStartConversationMutation();
  const [sendMessage] = useSendMessageMutation();

  useEffect(() => {
    if (!visible) {
      setDraft('');
      setMenuOpen(false);
      setSent([]);
      setLikeSent(false);
      setHideFirstBanner(false);
      setConversationId(null);
      setSending(false);
    }
  }, [visible, profile?.id]);

  const quickReplies = useMemo(
    () => [
      t('chat.quick.hey'),
      t('chat.quick.look'),
      t('chat.quick.weekend'),
      t('chat.quick.coffee'),
      t('chat.quick.fun'),
      t('chat.quick.city', {
        city: profile?.city ?? t('home.defaultCity'),
      }),
    ],
    [profile?.city, t],
  );

  if (!profile) {
    return null;
  }

  const photo = profile.photos?.[0]?.url;

  const handleSend = async (text?: string) => {
    const next = (text ?? draft).trim();
    if (!next || sent.length >= FREE_MSG_LIMIT || sending || !me) {
      return;
    }
    setSending(true);
    try {
      if (!conversationId) {
        const result = await startConversation({
          userId: profile.id,
          clientId: createClientId(),
          senderId: me.id,
          body: next,
        }).unwrap();
        setConversationId(result.conversation.id);
      } else {
        await sendMessage({
          conversationId,
          clientId: createClientId(),
          senderId: me.id,
          body: next,
        }).unwrap();
      }
      const nextCount = sent.length + 1;
      setSent(current => [...current, next]);
      setDraft('');
      if (nextCount >= 1 && !likeSent) {
        setLikeSent(true);
        onFirstMessage?.();
      }
      requestAnimationFrame(() => {
        threadRef.current?.scrollTo({ y: 0, animated: true });
      });
    } catch (error) {
      showErrorAlert(error);
    } finally {
      setSending(false);
    }
  };

  const chatLocked = sent.length >= FREE_MSG_LIMIT;
  const showFirstLikeBanner =
    sent.length >= 1 && !chatLocked && !hideFirstBanner;

  const dismissFirstBanner = () => {
    if (sent.length >= 1 && !chatLocked) {
      setHideFirstBanner(true);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.root, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <ImageBackground
          source={photo ? { uri: photo } : undefined}
          style={styles.hero}
          blurRadius={2}
        >
          <View style={styles.heroScrim} />
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={[styles.back, { marginTop: insets.top + 8 }]}
          >
            <Icon name="chevron-back" size={22} color={colors.textPrimary} />
          </Pressable>
        </ImageBackground>

        <View style={styles.card}>
          {photo ? <Image source={{ uri: photo }} style={styles.avatar} /> : null}
          <View style={styles.cardCopy}>
            <Text style={styles.cardName}>{profile.name}</Text>
            <View style={styles.metaRow}>
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: profile.isOnline
                      ? colors.success
                      : palette.gray400,
                  },
                ]}
              />
              <Text style={styles.meta}>
                {profile.isOnline ? t('boom.online') : t('boom.offline')}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.meta}>{profile.age}</Text>
              {profileFlagUrl(profile) ? (
                <Image
                  source={{ uri: profileFlagUrl(profile) }}
                  style={styles.flagImage}
                />
              ) : null}
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => setMenuOpen(current => !current)}
            style={styles.more}
          >
            <Icon name="ellipsis-horizontal" size={18} color={colors.textPrimary} />
          </Pressable>
        </View>

        <ScrollView
          ref={threadRef}
          style={styles.thread}
          contentContainerStyle={[
            styles.threadContent,
            sent.length === 0 && styles.threadEmpty,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {sent.length === 0 ? (
            <View style={styles.empty}>
              <Icon name="chatbubble-outline" size={28} color={palette.gray600} />
              <Text style={styles.emptyTitle}>{t('boom.noMessages')}</Text>
              <Text style={styles.emptyHint}>{t('boom.sayHello')}</Text>
              <View style={styles.quickBlock}>
                <QuickReplies
                  replies={quickReplies}
                  onPick={item => void handleSend(item)}
                />
              </View>
            </View>
          ) : (
            <View style={styles.messages}>
              {sent.map((item, index) => (
                <View key={`${item}-${index}`} style={styles.bubble}>
                  <Text style={styles.bubbleText}>{item}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        {menuOpen ? (
          <View style={styles.menu}>
            <Pressable
              style={styles.menuRow}
              onPress={() => {
                setMenuOpen(false);
                onBlock();
              }}
            >
              <Icon name="ban" size={16} color={colors.textSecondary} />
              <Text style={styles.menuLabel}>
                {t('boom.blockName', { name: profile.name })}
              </Text>
            </Pressable>
            <Pressable
              style={styles.menuRow}
              onPress={() => {
                setMenuOpen(false);
                onReport();
              }}
            >
              <Icon name="flag" size={16} color={colors.danger} />
              <Text style={[styles.menuLabel, { color: colors.danger }]}>
                {t('boom.reportName', { name: profile.name })}
              </Text>
            </Pressable>
            <Pressable style={styles.cancel} onPress={() => setMenuOpen(false)}>
              <Text style={styles.cancelLabel}>{t('boom.cancel')}</Text>
            </Pressable>
          </View>
        ) : null}

        {showFirstLikeBanner ? (
          <LikeSentBanner name={profile.name} variant="first" />
        ) : null}
        {chatLocked ? (
          <LikeSentBanner name={profile.name} variant="limit" />
        ) : null}

        <View style={[styles.composer, chatLocked && styles.composerDisabled]}>
          <TextInput
            value={draft}
            onChangeText={text => {
              dismissFirstBanner();
              if (!chatLocked) {
                setDraft(text);
              }
            }}
            placeholder={t('boom.messagePlaceholder', { name: profile.name })}
            placeholderTextColor={palette.gray500}
            style={styles.input}
            editable={!chatLocked && !sending}
            onFocus={dismissFirstBanner}
            onPressIn={dismissFirstBanner}
          />
          <Icon
            name="mic-outline"
            size={18}
            color={chatLocked ? palette.gray600 : colors.textMuted}
          />
          <Icon
            name="happy-outline"
            size={18}
            color={chatLocked ? palette.gray600 : colors.textMuted}
          />
          <Pressable
            disabled={chatLocked || sending}
            onPress={() => {
              dismissFirstBanner();
              void handleSend();
            }}
            style={[styles.send, chatLocked && styles.sendDisabled]}
          >
            <Icon
              name="send"
              size={16}
              color={chatLocked ? palette.gray500 : palette.white}
            />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  hero: {
    height: screen.height * 0.24,
    justifyContent: 'flex-start',
  },
  heroScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  back: {
    marginLeft: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    marginTop: -28,
    marginHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 22,
    backgroundColor: '#141414',
    zIndex: 2,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
  },
  cardCopy: {
    flex: 1,
    gap: 3,
  },
  cardName: {
    color: colors.textPrimary,
    fontSize: fontSize(16),
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  meta: {
    color: colors.textSecondary,
    fontSize: fontSize(12),
  },
  flag: {
    fontSize: 12,
  },
  flagImage: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  more: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thread: {
    flex: 1,
  },
  threadContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  threadEmpty: {
    justifyContent: 'center',
  },
  empty: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: fontSize(18),
    fontWeight: '700',
  },
  emptyHint: {
    color: colors.textMuted,
    fontSize: fontSize(13),
    marginBottom: 8,
  },
  quickBlock: {
    width: '100%',
    marginTop: 8,
  },
  messages: {
    width: '100%',
    gap: 8,
    alignItems: 'flex-end',
  },
  bubble: {
    alignSelf: 'flex-end',
    maxWidth: '82%',
    backgroundColor: homeAccent.purple,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bubbleText: {
    color: colors.textPrimary,
    fontSize: fontSize(14),
    lineHeight: 20,
  },
  menu: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 92,
    backgroundColor: '#141414',
    borderRadius: 20,
    padding: 12,
    gap: 8,
    zIndex: 5,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  menuLabel: {
    color: colors.textPrimary,
    fontSize: fontSize(15),
    fontWeight: '600',
  },
  cancel: {
    height: 44,
    borderRadius: 22,
    backgroundColor: palette.gray850,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelLabel: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 4,
    paddingLeft: 16,
    paddingRight: 6,
    height: 52,
    borderRadius: 26,
    backgroundColor: palette.gray900,
    borderWidth: 1,
    borderColor: palette.gray750,
  },
  composerDisabled: {
    opacity: 0.72,
    borderColor: palette.gray850,
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSize(14),
    paddingVertical: 0,
  },
  send: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: homeAccent.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: {
    backgroundColor: palette.gray750,
  },
});
