import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '@/navigation/types';

import { useSwipeMutation } from '../api/discoveryApi';
import type { SwipeRequest, SwipeResult } from '../types';

export function useSwipeAndMatch() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [swipe, status] = useSwipeMutation();

  const swipeAndMatch = async (body: SwipeRequest): Promise<SwipeResult> => {
    const result = await swipe(body).unwrap();
    if (result.match) {
      navigation.navigate('ItsAMatch', {
        matchId: result.match.id,
        conversationId: result.match.conversationId,
        name: result.match.user?.name ?? undefined,
        photo: result.match.user?.photos?.[0]?.url ?? null,
      });
    }
    return result;
  };

  return [swipeAndMatch, status] as const;
}
