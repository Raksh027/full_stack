import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, palette } from '@/theme';

type Props = {
  children: ReactNode;
};

type State = {
  failed: boolean;
};

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    this.setState({ failed: true });
  }

  render() {
    if (!this.state.failed) {
      return this.props.children;
    }
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.hint}>
          A screen hit missing data. You can retry without closing the app.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => this.setState({ failed: false })}
          style={styles.btn}
        >
          <Text style={styles.btnText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: palette.black,
    gap: 12,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSize(20),
    fontWeight: '800',
    textAlign: 'center',
  },
  hint: {
    color: colors.textSecondary,
    fontSize: fontSize(14),
    textAlign: 'center',
    lineHeight: 20,
  },
  btn: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: '#FF2D8A',
  },
  btnText: {
    color: palette.white,
    fontWeight: '800',
    fontSize: fontSize(15),
  },
});
