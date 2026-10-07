import { PAGE_SIZE } from '@/config/constants';
import { baseApi } from '@/services/api/baseApi';
import type { CursorPage, CursorPageParam } from '@/shared/types/api';
import {
  asCursorPage,
  normalizeJourney,
  normalizeTravelArrival,
  normalizeTravelCountry,
} from '@/shared/utils/normalizeApi';
import {
  cursorInfiniteQueryOptions,
  cursorParams,
} from '@/shared/utils/pagination';

import type { TravelArrival, TravelCountrySummary } from '../data/mockTravelArrivals';
import type { MyJourney } from '../data/mockMyJourneys';

export type JourneyWrite = Partial<MyJourney> & {
  hideFrom?: 'male' | 'female' | 'both' | null;
};

export type TravelArrivalsQuery = {
  fromCountry?: string | null;
  tripType?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
  travelStyle?: string | null;
  companion?: string | null;
};

export type TravelCountriesQuery = {
  q?: string | null;
  limit?: number;
};

export const travelApi = baseApi.injectEndpoints({
  endpoints: build => ({
    getTravelArrivals: build.infiniteQuery<
      CursorPage<TravelArrival>,
      TravelArrivalsQuery | void,
      CursorPageParam
    >({
      infiniteQueryOptions: cursorInfiniteQueryOptions,
      query: ({ queryArg, pageParam }) => ({
        url: '/travel/arrivals',
        params: {
          ...cursorParams(pageParam, PAGE_SIZE.travel),
          ...(queryArg?.fromCountry
            ? { fromCountry: queryArg.fromCountry }
            : {}),
          ...(queryArg?.tripType ? { tripType: queryArg.tripType } : {}),
          ...(queryArg?.fromDate ? { fromDate: queryArg.fromDate } : {}),
          ...(queryArg?.toDate ? { toDate: queryArg.toDate } : {}),
          ...(queryArg?.travelStyle
            ? { travelStyle: queryArg.travelStyle }
            : {}),
          ...(queryArg?.companion ? { companion: queryArg.companion } : {}),
        },
      }),
      transformResponse: (response: unknown) =>
        asCursorPage(response, normalizeTravelArrival),
      providesTags: ['Travel'],
    }),
    getTravelCountries: build.infiniteQuery<
      CursorPage<TravelCountrySummary>,
      TravelCountriesQuery | void,
      CursorPageParam
    >({
      infiniteQueryOptions: cursorInfiniteQueryOptions,
      query: ({ queryArg, pageParam }) => ({
        url: '/travel/countries',
        params: {
          ...cursorParams(
            pageParam,
            queryArg?.limit ?? PAGE_SIZE.travelCountries,
          ),
          ...(queryArg?.q ? { q: queryArg.q } : {}),
        },
      }),
      transformResponse: (response: unknown) =>
        asCursorPage(response, normalizeTravelCountry),
      providesTags: ['Travel'],
    }),
    getTravelArrival: build.query<TravelArrival, string>({
      query: arrivalId => `/travel/arrivals/${arrivalId}`,
      transformResponse: (response: unknown) =>
        normalizeTravelArrival(response) ??
        normalizeTravelArrival({ id: arrivalId, name: '' })!,
      providesTags: (_result, _error, arrivalId) => [
        'Travel',
        { type: 'Travel', id: arrivalId },
      ],
    }),
    getMyJourneys: build.infiniteQuery<
      CursorPage<MyJourney>,
      void,
      CursorPageParam
    >({
      infiniteQueryOptions: cursorInfiniteQueryOptions,
      query: ({ pageParam }) => ({
        url: '/travel/journeys',
        params: cursorParams(pageParam, PAGE_SIZE.journeys),
      }),
      transformResponse: (response: unknown) =>
        asCursorPage(response, normalizeJourney),
      providesTags: ['Travel'],
    }),
    getMyJourney: build.query<MyJourney, string>({
      query: journeyId => `/travel/journeys/${journeyId}`,
      transformResponse: (response: unknown) =>
        normalizeJourney(response) ??
        normalizeJourney({ id: journeyId, fromCity: '', toCity: '' })!,
      providesTags: (_result, _error, journeyId) => [
        'Travel',
        { type: 'Travel', id: journeyId },
      ],
    }),
    createJourney: build.mutation<MyJourney, JourneyWrite>({
      query: body => ({ url: '/travel/journeys', method: 'POST', body }),
      transformResponse: (response: unknown) =>
        normalizeJourney(response) ??
        normalizeJourney({ id: 'new', fromCity: '', toCity: '' })!,
      invalidatesTags: ['Travel'],
    }),
    updateJourney: build.mutation<
      MyJourney,
      { journeyId: string; body: JourneyWrite }
    >({
      query: ({ journeyId, body }) => ({
        url: `/travel/journeys/${journeyId}`,
        method: 'PATCH',
        body,
      }),
      transformResponse: (response: unknown) =>
        normalizeJourney(response) ??
        normalizeJourney({ id: journeyId, fromCity: '', toCity: '' })!,
      invalidatesTags: ['Travel'],
    }),
    deleteJourney: build.mutation<void, string>({
      query: journeyId => ({
        url: `/travel/journeys/${journeyId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Travel'],
    }),
  }),
});

export const {
  useGetTravelArrivalsInfiniteQuery,
  useGetTravelCountriesInfiniteQuery,
  useGetTravelArrivalQuery,
  useGetMyJourneysInfiniteQuery,
  useGetMyJourneyQuery,
  useCreateJourneyMutation,
  useUpdateJourneyMutation,
  useDeleteJourneyMutation,
} = travelApi;
