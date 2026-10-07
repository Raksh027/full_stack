export type SocialProfileHints = {
  birthDate?: string;
  gender?: string;
};

const GENDER_MAP: Record<string, string> = {
  male: 'man',
  man: 'man',
  m: 'man',
  female: 'woman',
  woman: 'woman',
  f: 'woman',
  nonbinary: 'nonbinary',
  'non-binary': 'nonbinary',
  non_binary: 'nonbinary',
  transgender: 'transgender',
  trans: 'transgender',
};

function mapGender(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  return GENDER_MAP[value.trim().toLowerCase()];
}

function isoDate(year?: number, month?: number, day?: number): string | undefined {
  if (!year || !month || !day) {
    return undefined;
  }
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return undefined;
  }
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function hintsFromGooglePeople(payload: {
  birthdays?: Array<{ date?: { year?: number; month?: number; day?: number }; metadata?: { primary?: boolean } }>;
  genders?: Array<{ value?: string; metadata?: { primary?: boolean } }>;
}): SocialProfileHints {
  const birthday =
    payload.birthdays?.find(item => item.metadata?.primary) ?? payload.birthdays?.[0];
  const genderRow =
    payload.genders?.find(item => item.metadata?.primary) ?? payload.genders?.[0];
  return {
    birthDate: isoDate(birthday?.date?.year, birthday?.date?.month, birthday?.date?.day),
    gender: mapGender(genderRow?.value),
  };
}

export async function fetchGooglePeopleHints(
  accessToken: string,
): Promise<SocialProfileHints> {
  const response = await fetch(
    'https://people.googleapis.com/v1/people/me?personFields=birthdays,genders',
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!response.ok) {
    return {};
  }
  return hintsFromGooglePeople(await response.json());
}
