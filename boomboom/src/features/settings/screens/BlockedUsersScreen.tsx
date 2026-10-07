import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  useGetBlockedUsersInfiniteQuery,
  useUnblockUserMutation,
} from '@/features/safety/api/safetyApi';
import type { RootStackScreenProps } from '@/navigation/types';
import { Icon, InfiniteListFooter, ScreenContainer } from '@/shared/components';
import { showErrorAlert } from '@/shared/utils/alerts';
import { flatPageItems, loadMoreIfNeeded } from '@/shared/utils/pagination';
import { colors, fontSize } from '@/theme';

import { SettingsPageHeader } from '../components/SettingsPageHeader';

type Props = RootStackScreenProps<'BlockedUsers'>;

export function BlockedUsersScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const {
    data,
    isLoading,
    isError,
    refetch,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useGetBlockedUsersInfiniteQuery();
  const items = flatPageItems(data);
  const [unblock] = useUnblockUserMutation();

  return (
    <ScreenContainer edges={['top']}>
      <SettingsPageHeader
        title={t('settings.blockedTitle')}
        onBack={() => navigation.goBack()}
      />
      {isLoading ? (
        <View style={styles.empty}>
          <ActivityIndicator color={colors.textPrimary} />
        </View>
      ) : isError ? (
        <View style={styles.empty}>
          <Pressable onPress={() => refetch()}>
            <Text style={styles.emptyTitle}>{t('common.retry')}</Text>
          </Pressable>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.iconRing}>
            <Icon name="person" size={28} color="#B57BFF" />
            <View style={styles.slash} />
          </View>
          <Text style={styles.emptyTitle}>{t('settings.blockedEmpty')}</Text>
          <Text style={styles.emptyHint}>{t('settings.blockedEmptyHint')}</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          onEndReached={() =>
            loadMoreIfNeeded({ hasNextPage, isFetchingNextPage, fetchNextPage })
          }
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            <InfiniteListFooter loading={isFetchingNextPage} />
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              {item.photos?.[0]?.url ? (
                <Image
                  source={{ uri: item.photos?.[0]?.url }}
                  style={styles.avatar}
                />
              ) : (
                <View style={styles.avatar} />
              )}
              <Text style={styles.name}>{item.name}</Text>
              <Pressable
                onPress={() => unblock(item.id).unwrap().catch(showErrorAlert)}
              >
                <Text style={styles.unblock}>{t('settings.unblock')}</Text>
              </Pressable>
            </View>
          )}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 10,
    marginTop: -48,
  },
  iconRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1.5,
    borderColor: '#5B3A86',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  slash: {
    position: 'absolute',
    width: 42,
    height: 1.5,
    backgroundColor: '#B57BFF',
    transform: [{ rotate: '-28deg' }],
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: fontSize(20),
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyHint: {
    color: colors.textSecondary,
    fontSize: fontSize(14),
    textAlign: 'center',
    lineHeight: 21,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1A1A1A',
  },
  name: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSize(15),
    fontWeight: '700',
  },
  unblock: {
    color: colors.textSecondary,
    fontSize: fontSize(13),
    fontWeight: '600',
  },
});
