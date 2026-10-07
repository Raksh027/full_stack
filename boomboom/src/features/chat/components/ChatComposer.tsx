import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { MESSAGE_MAX_LENGTH } from '@/config/constants';
import { Icon } from '@/shared/components';
import { colors, fontSize, palette } from '@/theme';

import { chatAccent } from '../theme';

type Props = {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  onInteract?: () => void;
};

export function ChatComposer({
  value,
  placeholder,
  onChange,
  onSend,
  disabled = false,
  onInteract,
}: Props) {
  const canSend = !disabled && value.trim().length > 0;

  return (
    <View style={[styles.row, disabled && styles.rowDisabled]}>
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={onInteract}
        style={[styles.circle, disabled && styles.circleDisabled]}
      >
        <Icon
          name="camera"
          size={18}
          color={disabled ? palette.gray500 : palette.white}
        />
      </Pressable>
      <View style={[styles.inputWrap, disabled && styles.inputWrapDisabled]}>
        <TextInput
          value={value}
          onChangeText={text => {
            onInteract?.();
            if (!disabled) {
              onChange(text);
            }
          }}
          placeholder={placeholder}
          placeholderTextColor={palette.gray500}
          style={styles.input}
          maxLength={MESSAGE_MAX_LENGTH}
          multiline
          editable={!disabled}
          onFocus={onInteract}
          onPressIn={onInteract}
          onSubmitEditing={canSend ? onSend : undefined}
        />
        <Icon
          name="happy-outline"
          size={18}
          color={disabled ? palette.gray600 : palette.gray400}
        />
      </View>
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={canSend ? onSend : onInteract}
        style={[styles.circle, disabled && styles.circleDisabled]}
      >
        {canSend ? (
          <Icon name="send" size={16} color={palette.white} />
        ) : (
          <Icon
            name="mic"
            size={18}
            color={disabled ? palette.gray500 : palette.white}
          />
        )}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={onInteract}
        style={[styles.circle, disabled && styles.circleDisabled]}
      >
        <Text style={[styles.gif, disabled && styles.gifDisabled]}>GIF</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  rowDisabled: {
    opacity: 0.72,
  },
  circle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: chatAccent.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleDisabled: {
    backgroundColor: palette.gray750,
  },
  inputWrap: {
    flex: 1,
    minHeight: 42,
    maxHeight: 110,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingLeft: 16,
    paddingRight: 12,
    paddingVertical: 8,
    borderRadius: 22,
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: palette.gray750,
  },
  inputWrapDisabled: {
    backgroundColor: palette.gray900,
    borderColor: palette.gray850,
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSize(14),
    paddingTop: 2,
    paddingBottom: 2,
  },
  gif: {
    color: palette.white,
    fontSize: 9,
    fontWeight: '800',
  },
  gifDisabled: {
    color: palette.gray500,
  },
});
