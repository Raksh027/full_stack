import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/shared/components';
import { colors, fontSize, palette } from '@/theme';

import { chatAccent } from '../theme';
import type { ChatMessage } from '../types';
import { formatMessageTime } from '../utils/formatInboxTime';

type Props = {
  message: ChatMessage;
  isMine: boolean;
};

export function MessageBubble({ message, isMine }: Props) {
  const failed = message.status === 'failed';

  return (
    <View style={[styles.wrap, isMine ? styles.wrapMine : styles.wrapTheirs]}>
      <View
        style={[
          styles.bubble,
          isMine ? styles.mine : styles.theirs,
          failed && styles.failed,
        ]}
      >
        <Text style={styles.body}>{message.body}</Text>
      </View>
      <View style={[styles.meta, isMine && styles.metaMine]}>
        <Text style={styles.time}>{formatMessageTime(message.createdAt)}</Text>
        {isMine ? (
          <Icon
            name={
              message.status === 'read'
                ? 'checkmark-done'
                : message.status === 'failed'
                  ? 'alert-circle-outline'
                  : message.status === 'sending'
                    ? 'time-outline'
                    : 'checkmark'
            }
            size={12}
            color={
              message.status === 'read'
                ? chatAccent.blue
                : failed
                  ? colors.danger
                  : palette.gray400
            }
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    maxWidth: '78%',
    marginBottom: 14,
  },
  wrapMine: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  wrapTheirs: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  bubble: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
  },
  mine: {
    backgroundColor: chatAccent.blue,
    borderBottomRightRadius: 8,
  },
  theirs: {
    backgroundColor: chatAccent.incoming,
    borderBottomLeftRadius: 8,
  },
  failed: {
    borderWidth: 1,
    borderColor: colors.danger,
  },
  body: {
    color: colors.textPrimary,
    fontSize: fontSize(15),
    lineHeight: 21,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  metaMine: {
    justifyContent: 'flex-end',
  },
  time: {
    color: palette.gray400,
    fontSize: fontSize(10),
    fontWeight: '600',
  },
});
