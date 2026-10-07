import type { PropsWithChildren } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import {
  BackButton,
  Logo,
  ScreenContainer,
  TypingText,
} from '@/shared/components';
import { colors, scale, screen, verticalScale } from '@/theme';

type Props = PropsWithChildren<{
  brandName?: string;
  showBackButton?: boolean;
}>;

export function AuthLayout({
  brandName,
  showBackButton = false,
  children,
}: Props) {
  return (
    <ScreenContainer>
      {showBackButton ? <BackButton style={styles.back} /> : null}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoContainer}>
            <Logo />
            {brandName ? (
              <TypingText text={brandName} style={styles.brandName} />
            ) : null}
          </View>
          <View style={styles.form}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  back: {
    marginLeft: scale(8),
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: screen.isTablet ? scale(40) : scale(20),
    paddingVertical: verticalScale(20),
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: verticalScale(20),
  },
  brandName: {
    fontSize: screen.width * 0.06,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  form: {
    width: '100%',
    maxWidth: screen.isTablet ? 500 : undefined,
    alignSelf: 'center',
  },
});
