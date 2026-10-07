import { Alert } from 'react-native';

import { parseApiError } from '@/services/api/apiError';
import { i18n } from '@/services/i18n';

export function showSuccessAlert(
  message: string,
  title: string = i18n.t('common.success'),
  onOk?: () => void,
) {
  Alert.alert(title, message, [{ text: i18n.t('common.ok'), onPress: onOk }]);
}

export function showErrorAlert(
  error: unknown,
  title: string = i18n.t('common.error'),
) {
  const { status, message } = parseApiError(error);
  const body =
    status === 'NETWORK'
      ? i18n.t('errors.network')
      : status === 'TIMEOUT'
        ? i18n.t('errors.timeout')
        : message || i18n.t('errors.unknown');
  Alert.alert(title, body);
}
