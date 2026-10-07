import { useRef } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type TextInputInstance,
  type TextInputKeyPressEvent,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { colors, fontSize, screen } from '@/theme';

type Props = {
  length: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  editable?: boolean;
};

const BOX_SIZE = Math.min((screen.width - 88) / 4, 64);

export function CodeInput({
  length,
  value,
  onChange,
  onComplete,
  editable = true,
}: Props) {
  const inputs = useRef<(TextInputInstance | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? '');

  const handleChangeText = (text: string, index: number) => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length > 1) {
      const next = cleaned.slice(0, length);
      onChange(next);
      inputs.current[Math.min(next.length, length - 1)]?.focus();
      if (next.length === length) {
        onComplete?.(next);
      }
      return;
    }

    const nextDigits = [...digits];
    nextDigits[index] = cleaned;
    const next = nextDigits.join('');
    onChange(next);

    if (cleaned && index < length - 1) {
      inputs.current[index + 1]?.focus();
    }
    if (next.length === length && !nextDigits.includes('')) {
      onComplete?.(next);
    }
  };

  const handleKeyPress = (
    { nativeEvent }: TextInputKeyPressEvent,
    index: number,
  ) => {
    if (nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  return (
    <View style={styles.row}>
      {digits.map((digit, index) => {
        const active = digit.length > 0 || index === value.length;
        return (
          <LinearGradient
            key={index}
            colors={active ? [...colors.gradientBorder] : ['#2C2C36', '#2C2C36']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.border}
          >
            <TextInput
              ref={ref => {
                inputs.current[index] = ref;
              }}
              style={styles.box}
              value={digit}
              onChangeText={text => handleChangeText(text, index)}
              onKeyPress={event => handleKeyPress(event, index)}
              keyboardType="number-pad"
              textContentType={index === 0 ? 'oneTimeCode' : 'none'}
              autoComplete={index === 0 ? 'one-time-code' : 'off'}
              maxLength={index === 0 ? length : 1}
              selectTextOnFocus
              editable={editable}
              placeholder="•"
              placeholderTextColor="#3A3A44"
              accessibilityLabel={`Digit ${index + 1}`}
            />
          </LinearGradient>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  border: {
    width: BOX_SIZE,
    height: BOX_SIZE,
    borderRadius: 18,
    padding: 1.5,
  },
  box: {
    flex: 1,
    borderRadius: 16.5,
    textAlign: 'center',
    fontSize: fontSize(22),
    fontWeight: '700',
    backgroundColor: '#121218',
    color: colors.textPrimary,
  },
});
