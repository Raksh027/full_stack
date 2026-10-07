import { parseApiError } from '../apiError';

describe('parseApiError', () => {
  it('reads FastAPI HTTPException detail strings', () => {
    expect(
      parseApiError({ status: 401, data: { detail: 'Invalid credentials' } }),
    ).toEqual({ status: 401, message: 'Invalid credentials' });
  });

  it('maps FastAPI validation errors to field errors', () => {
    const error = parseApiError({
      status: 422,
      data: {
        detail: [
          {
            loc: ['body', 'email'],
            msg: 'value is not a valid email',
            type: 'value_error',
          },
          { loc: ['body', 'password'], msg: 'too short', type: 'value_error' },
        ],
      },
    });
    expect(error.status).toBe(422);
    expect(error.fieldErrors).toEqual({
      email: 'value is not a valid email',
      password: 'too short',
    });
  });

  it('treats fetch failures as network errors', () => {
    expect(
      parseApiError({ status: 'FETCH_ERROR', error: 'Network request failed' }),
    ).toMatchObject({ status: 'NETWORK' });
  });
});
