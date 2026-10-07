import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { selectSessionUser } from '@/features/auth/store/authSlice';
import { useSwipeAndMatch } from '@/features/discovery/hooks/useSwipeAndMatch';
import { useGetProfileQuery } from '@/features/profile/api/profileApi';
import {
  useBlockUserMutation,
  useReportUserMutation,
} from '@/features/safety/api/safetyApi';
import type { RootStackScreenProps } from '@/navigation/types';
import { Icon, InfiniteListFooter, ScreenContainer } from '@/shared/components';
import { createClientId } from '@/shared/utils/id';
import { flatMessagePages, flatPageItems, loadMoreIfNeeded } from '@/shared/utils/pagination';
import { profileFlagUrl } from '@/shared/utils/profileFlag';
import { useAppSelector } from '@/store/hooks';
import { colors, fontSize, palette } from '@/theme';

import {
  useGetConversationsInfiniteQuery,
  useGetMessagesInfiniteQuery,
  useMarkConversationReadMutation,
  useSendMessageMutation,
} from '../api/chatApi';
import { ChatComposer } from '../components/ChatComposer';
import { ChatHeader } from '../components/ChatHeader';
import { ChatRequestCard } from '../components/ChatRequestCard';
import { LikeSentBanner } from '../components/LikeSentBanner';
import { MessageBubble } from '../components/MessageBubble';
import { QuickReplies } from '../components/QuickReplies';
import { SafetySheet } from '../components/SafetySheet';
import { chatAccent } from '../theme';
import type { ChatMessage } from '../types';
import { formatInboxTime, formatThreadDay, isSameDay } from '../utils/formatInboxTime';

type Props = RootStackScreenProps<'Chat'>;

type ThreadItem =
  | { kind: 'day'; id: string; label: string }
  | { kind: 'message'; id: string; message: ChatMessage };

type PendingAction = 'like' | 'send';

const FREE_MSG_LIMIT = 3;

function genderShort(gender?: string | null) {
  if (gender === 'woman') return 'F';
  if (gender === 'man') return 'M';
  return null;
}

function lastSeenLabel(
  isOnline: boolean,
  updatedAt?: string,
  fallback = 'Offline',
) {
  if (isOnline) {
    return 'Online';
  }
  if (!updatedAt) {
    return fallback;
  }
  const mins = Math.max(
    1,
    Math.round((Date.now() - new Date(updatedAt).getTime()) / 60_000),
  );
  if (mins < 60) {
    return `${mins} min ago`;
  }
  return formatInboxTime(updatedAt);
}

export function ChatScreen({ navigation, route }: Props) {
  const {
    conversationId,
    requestAccepted = false,
    showSafetyPrompt = false,
  } = route.params;
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<ThreadItem>>(null);
  const me = useAppSelector(selectSessionUser);
  const { data: inbox } = useGetConversationsInfiniteQuery();
  const conversation = useMemo(
    () =>
      inbox
        ? flatPageItems(inbox).find(item => item.id === conversationId)
        : undefined,
    [inbox, conversationId],
  );
  const { data: profile } = useGetProfileQuery(conversation?.user?.id ?? '', {
    skip: !conversation?.user?.id,
  });
  const userOnline = useAppSelector(state =>
    conversation?.user?.id
      ? Boolean(state.chat.onlineUserIds[conversation.user.id])
      : false,
  );
  const {
    data,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useGetMessagesInfiniteQuery(conversationId);
  const [sendMessage] = useSendMessageMutation();
  const [markRead] = useMarkConversationReadMutation();
  const [swipe] = useSwipeAndMatch();
  const [blockUser] = useBlockUserMutation();
  const [reportUser] = useReportUserMutation();
  const [draft, setDraft] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [safetySeen, setSafetySeen] = useState(false);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [pendingBody, setPendingBody] = useState('');
  const [likeSent, setLikeSent] = useState(requestAccepted);
  const [hideFirstBanner, setHideFirstBanner] = useState(false);

  const chronological = useMemo(() => flatMessagePages(data), [data]);

  const thread = useMemo<ThreadItem[]>(() => {
    const rows: ThreadItem[] = [];
    chronological.forEach((message, index) => {
      const previous = chronological[index - 1];
      if (!previous || !isSameDay(previous.createdAt, message.createdAt)) {
        rows.push({
          kind: 'day',
          id: `day-${message.createdAt}`,
          label: formatThreadDay(message.createdAt),
        });
      }
      rows.push({ kind: 'message', id: message.id, message });
    });
    return rows;
  }, [chronological]);

  const mySentCount = chronological.filter(
    message => message.senderId === me?.id,
  ).length;
  const iSent = mySentCount > 0;
  const chatLocked = mySentCount >= FREE_MSG_LIMIT;
  const showRequest = !requestAccepted && !likeSent && !iSent;
  const showFirstLikeBanner =
    mySentCount >= 1 && !chatLocked && !hideFirstBanner;
  const showLimitLikeBanner = chatLocked;

  useEffect(() => {
    setHideFirstBanner(false);
    setLikeSent(requestAccepted);
    setPending(null);
    if (showSafetyPrompt) {
      setSafetyOpen(true);
      setSafetySeen(false);
    } else {
      setSafetyOpen(false);
    }
  }, [conversationId, requestAccepted, showSafetyPrompt]);

  useEffect(() => {
    if (mySentCount >= 1 && !likeSent && conversation) {
      setLikeSent(true);
      swipe({ targetUserId: conversation.user.id, action: 'like' });
    }
  }, [conversation, likeSent, mySentCount, swipe]);

  const lastMessageId = chronological[chronological.length - 1]?.id;

  useEffect(() => {
    if (!lastMessageId) {
      return;
    }
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, [conversationId, lastMessageId]);

  useEffect(() => {
    if (lastMessageId && conversation?.unreadCount) {
      markRead({ conversationId, lastReadMessageId: lastMessageId });
    }
  }, [conversation?.unreadCount, conversationId, lastMessageId, markRead]);

  const completeLike = () => {
    if (!conversation) {
      return;
    }
    setLikeSent(true);
    swipe({ targetUserId: conversation.user.id, action: 'like' });
  };

  const sendBody = (text: string) => {
    const body = text.trim();
    if (!body || !me || mySentCount >= FREE_MSG_LIMIT) {
      return;
    }
    setDraft('');
    sendMessage({
      conversationId,
      clientId: createClientId(),
      senderId: me.id,
      body,
    });
    if (!likeSent) {
      completeLike();
    }
  };

  const withSafety = (action: PendingAction, body = '') => {
    if (safetySeen) {
      if (action === 'like') {
        completeLike();
      } else {
        sendBody(body);
      }
      return;
    }
    setPending(action);
    setPendingBody(body);
    setSafetyOpen(true);
  };

  const name = conversation?.user?.name ?? t('chat.title');
  const photo = profile?.photos?.[0]?.url ?? conversation?.user.photos?.[0]?.url;
  const city = profile?.city ?? null;
  const showQuickChat = chronological.length === 0;
  const quickReplies = useMemo(
    () => [
      t('chat.quick.hey'),
      t('chat.quick.look'),
      t('chat.quick.weekend'),
      t('chat.quick.coffee'),
      t('chat.quick.fun'),
      t('chat.quick.city', { city: city ?? t('home.defaultCity') }),
    ],
    [city, t],
  );

  return (
    <ScreenContainer edges={['top']}>
      <ChatHeader
        name={name}
        photo={photo}
        age={profile?.age ?? conversation?.user.age}
        genderLabel={genderShort(profile?.gender)}
        city={city}
        flagUrl={profileFlagUrl({
          countryFlag: profile?.countryFlag,
          countryCode: profile?.countryCode,
          country: profile?.country,
        })}
        verified={profile?.isVerified ?? conversation?.user.isVerified}
        distanceKm={
          profile && 'distanceKm' in profile
            ? ((profile as { distanceKm?: number | null }).distanceKm ?? 12)
            : 12
        }
        statusLabel={
          userOnline
            ? t('chat.online')
            : lastSeenLabel(false, conversation?.updatedAt, t('chat.offline'))
        }
        statusOnline={userOnline}
        onBack={() => navigation.goBack()}
        onOpenProfile={() =>
          conversation &&
          navigation.navigate('UserProfile', { userId: conversation.user.id })
        }
        onMore={() => setMenuOpen(current => !current)}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {isLoading && thread.length === 0 ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.textPrimary} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={thread}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.thread}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onStartReached={() =>
              loadMoreIfNeeded({
                hasNextPage,
                isFetchingNextPage,
                fetchNextPage,
              })
            }
            onStartReachedThreshold={0.2}
            maintainVisibleContentPosition={{
              minIndexForVisible: 0,
            }}
            ListHeaderComponent={
              <InfiniteListFooter loading={isFetchingNextPage} />
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>{t('chat.noMessages')}</Text>
                <Text style={styles.emptyHint}>
                  {t('chat.sayHello', { name })}
                </Text>
                {showQuickChat ? (
                  <View style={styles.quickBlock}>
                    <QuickReplies
                      replies={quickReplies}
                      onPick={reply => {
                        withSafety('send', reply);
                        requestAnimationFrame(() => {
                          listRef.current?.scrollToOffset({
                            offset: 0,
                            animated: true,
                          });
                        });
                      }}
                    />
                  </View>
                ) : null}
              </View>
            }
            renderItem={({ item }) =>
              item.kind === 'day' ? (
                <View style={styles.dayPill}>
                  <Text style={styles.dayLabel}>{item.label}</Text>
                </View>
              ) : (
                <MessageBubble
                  message={item.message}
                  isMine={item.message.senderId === me?.id}
                />
              )
            }
          />
        )}

        {menuOpen && conversation ? (
          <View style={styles.menu}>
            <Pressable
              style={styles.menuRow}
              onPress={() => {
                setMenuOpen(false);
                blockUser(conversation.user.id);
                navigation.goBack();
              }}
            >
              <Icon name="ban" size={16} color={colors.textSecondary} />
              <Text style={styles.menuLabel}>
                {t('boom.blockName', { name })}
              </Text>
            </Pressable>
            <Pressable
              style={styles.menuRow}
              onPress={() => {
                setMenuOpen(false);
                reportUser({
                  userId: conversation.user.id,
                  reason: 'spam',
                });
              }}
            >
              <Icon name="flag" size={16} color={colors.danger} />
              <Text style={[styles.menuLabel, { color: colors.danger }]}>
                {t('boom.reportName', { name })}
              </Text>
            </Pressable>
            <Pressable style={styles.cancel} onPress={() => setMenuOpen(false)}>
              <Text style={styles.cancelLabel}>{t('boom.cancel')}</Text>
            </Pressable>
          </View>
        ) : null}

        {showRequest ? (
          <ChatRequestCard
            name={name}
            onLike={() => withSafety('like')}
            onDislike={() => navigation.goBack()}
          />
        ) : null}
        {showFirstLikeBanner ? (
          <LikeSentBanner name={name} variant="first" />
        ) : null}
        {showLimitLikeBanner ? (
          <LikeSentBanner name={name} variant="limit" />
        ) : null}

        <View
          style={[
            styles.composerWrap,
            { paddingBottom: Math.max(insets.bottom, 12) },
          ]}
        >
          <ChatComposer
            value={draft}
            placeholder={t('chat.messagePlaceholder', { name })}
            onChange={setDraft}
            onSend={() => withSafety('send', draft)}
            disabled={chatLocked}
            onInteract={() => {
              if (mySentCount >= 1 && !chatLocked) {
                setHideFirstBanner(true);
              }
            }}
          />
        </View>
      </KeyboardAvoidingView>

      <SafetySheet
        visible={safetyOpen}
        onClose={() => {
          setSafetyOpen(false);
          setSafetySeen(true);
          setPending(null);
          setPendingBody('');
        }}
        onContinue={() => {
          setSafetyOpen(false);
          setSafetySeen(true);
          if (pending === 'like') {
            completeLike();
          } else if (pending === 'send') {
            sendBody(pendingBody || draft);
          }
          setPending(null);
          setPendingBody('');
        }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thread: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    flexGrow: 1,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 48,
    paddingHorizontal: 16,
    gap: 8,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: fontSize(20),
    fontWeight: '800',
  },
  emptyHint: {
    color: colors.textMuted,
    fontSize: fontSize(13),
    textAlign: 'center',
    marginBottom: 8,
  },
  quickBlock: {
    width: '100%',
    marginTop: 12,
  },
  dayPill: {
    alignSelf: 'center',
    backgroundColor: chatAccent.card,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginVertical: 10,
  },
  dayLabel: {
    color: colors.textSecondary,
    fontSize: fontSize(11),
    fontWeight: '700',
  },
  menu: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: chatAccent.card,
    borderRadius: 20,
    padding: 12,
    gap: 4,
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
  composerWrap: {
    paddingHorizontal: 12,
    paddingTop: 6,
  },
});
