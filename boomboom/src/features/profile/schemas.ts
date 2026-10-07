import { z } from 'zod';

import { PROFILE_RULES } from '@/config/constants';
import { calculateAge } from '@/shared/utils/date';

export const basicInfoSchema = z.object({
  name: z
    .string()
    .trim()
    .min(PROFILE_RULES.minNameLength, 'Name must be at least 2 characters long')
    .max(PROFILE_RULES.maxNameLength),
  birthDate: z
    .date({ error: 'Please select your date of birth' })
    .refine(date => calculateAge(date) >= PROFILE_RULES.minAge, {
      message: `You must be at least ${PROFILE_RULES.minAge} years old`,
    })
    .refine(date => calculateAge(date) <= PROFILE_RULES.maxAge, {
      message: 'Enter a valid birth date',
    }),
  gender: z.enum(['man', 'woman', 'transgender', 'nonbinary'], {
    error: 'Please select your gender',
  }),
  bio: z.string().trim().max(PROFILE_RULES.maxBioLength),
});

export type BasicInfoForm = z.infer<typeof basicInfoSchema>;
