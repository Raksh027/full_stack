import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';

import { parseApiError } from '@/services/api/apiError';

import { showErrorAlert } from './alerts';

/**
 * Maps FastAPI validation errors onto form fields; anything that can't be
 * attached to a field is shown as an alert.
 */
export function handleFormSubmitError<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
  alertTitle?: string,
) {
  const { fieldErrors } = parseApiError(error);
  let attached = false;
  for (const field of fields) {
    const message = fieldErrors?.[field];
    if (message) {
      setError(field, { type: 'server', message });
      attached = true;
    }
  }
  if (!attached) {
    showErrorAlert(error, alertTitle);
  }
}
