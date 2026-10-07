import { z } from 'zod';

import { EMAIL_VERIFICATION } from '@/config/constants';

const email = z.email('Enter a valid email address').trim().toLowerCase();

export const emailSignInSchema = z.object({
  email,
});

export const forgotPasswordSchema = z.object({ email });

export const emailVerificationSchema = z.object({
  code: z
    .string()
    .regex(
      new RegExp(`^\\d{${EMAIL_VERIFICATION.codeLength}}$`),
      `Enter the ${EMAIL_VERIFICATION.codeLength}-digit code`,
    ),
});

export type EmailSignInForm = z.infer<typeof emailSignInSchema>;
export type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;
