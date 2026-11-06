import { z } from 'zod';

export const createComparisonSchema = z.object({
  candidateAId: z
    .string({ required_error: 'candidateAId is required.' })
    .trim()
    .min(1, 'candidateAId is required.'),
  candidateBId: z
    .string({ required_error: 'candidateBId is required.' })
    .trim()
    .min(1, 'candidateBId is required.'),
  raceId: z.string().trim().min(1).optional(),
});

export const paginationQuerySchema = z.object({
  page: z.coerce
    .number()
    .int('Page must be a whole number.')
    .min(1, 'Page must be at least 1.')
    .default(1),
  limit: z.coerce
    .number()
    .int('Limit must be a whole number.')
    .min(1, 'Limit must be at least 1.')
    .max(100, 'Limit must be at most 100.')
    .default(20),
});

export default {
  createComparisonSchema,
  paginationQuerySchema,
};
