import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  FlatList,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import { images } from '@/assets';
import { RELATIONSHIP_GOAL_OPTIONS } from '@/features/profile/constants/profileOptions';
import type { RelationshipGoal } from '@/features/profile/types';
import {
  BackButton,
  ScreenContainer,
} from '@/shared/components';

import { GoalCard } from '../components/GoalCard';
import { OnboardingNextButton } from '../components/OnboardingNextButton';
import { StepHeader } from '../components/StepHeader';
import { useProfileStep } from '../hooks/useProfileStep';

const HORIZONTAL_PADDING = 20;
const COLUMN_GAP = 15;

export function RelationshipGoalScreen() {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const { profile, isSaving, saveAndContinue } = useProfileStep();
  const [goal, setGoal] = useState<RelationshipGoal | null>(null);

  const cardWidth = (width - HORIZONTAL_PADDING * 2 - COLUMN_GAP) / 2;

  useEffect(() => {
    if (profile?.relationshipGoal) {
      setGoal(profile.relationshipGoal);
    }
  }, [profile?.relationshipGoal]);

  const handleNext = () => {
    if (!goal) {
      Alert.alert(t('common.error'), t('onboarding.relationshipGoal.required'));
      return;
    }
    saveAndContinue({ relationshipGoal: goal });
  };

  return (
    <ScreenContainer>
      <BackButton style={styles.back} />
      <FlatList
        data={RELATIONSHIP_GOAL_OPTIONS}
        keyExtractor={item => item.value}
        numColumns={2}
        columnWrapperStyle={styles.column}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <StepHeader
              title={t('onboarding.relationshipGoal.title')}
              subtitle={t('onboarding.relationshipGoal.subtitle')}
            />
          </View>
        }
        renderItem={({ item }) => (
          <GoalCard
            title={t(`profileOptions.relationshipGoal.${item.value}.title`)}
            description={t(
              `profileOptions.relationshipGoal.${item.value}.description`,
            )}
            image={images.relationshipGoal}
            width={cardWidth}
            selected={goal === item.value}
            onPress={() => setGoal(item.value)}
          />
        )}
      />
      <View style={styles.cta}>
        <OnboardingNextButton
          onPress={handleNext}
          ready={Boolean(goal)}
          loading={isSaving}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  back: {
    marginLeft: 10,
  },
  header: {
    paddingTop: 10,
  },
  list: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingBottom: 120,
  },
  column: {
    justifyContent: 'space-between',
  },
  cta: {
    paddingHorizontal: 22,
    paddingBottom: 8,
  },
});
