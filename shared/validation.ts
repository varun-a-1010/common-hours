import { z } from 'zod';
import { diets, interests, minutes } from './model';

const text = (max: number) => z.string().trim().max(max);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const briefSchema = z
  .object({
    title: text(100).min(2),
    goal: text(500),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine(
        (v) => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v,
        'Choose a valid date.',
      ),
    startTime: time,
    endTime: time,
    city: text(100).min(2),
    location: text(200),
    headcount: z.number().int().min(1).max(60),
    budget: z.number().int().min(100).max(10000000),
    format: z.enum(['office', 'outing', 'either']),
    includeMeal: z.boolean(),
    travelMinutes: z.number().int().min(0).max(90),
  })
  .refine((b) => minutes(b.endTime) - minutes(b.startTime) >= 45, {
    message: 'Allow at least 45 minutes, ending on the same day.',
    path: ['endTime'],
  });

export const memberSchema = z
  .object({
    name: text(80).min(1),
    likes: z
      .array(z.enum(interests))
      .max(8)
      .transform((a) => [...new Set(a)]),
    avoids: z
      .array(z.enum(interests))
      .max(8)
      .transform((a) => [...new Set(a)]),
    diets: z
      .array(z.enum(diets))
      .max(4)
      .transform((a) => [...new Set(a)]),
    stepFree: z.boolean(),
    notes: text(600),
    favourites: text(400),
  })
  .refine((m) => !m.likes.some((t) => m.avoids.includes(t)), {
    message: 'An interest cannot also be something to avoid.',
    path: ['avoids'],
  });

export const catalogueSchema = z
  .object({
    kind: z.enum(['activity', 'meal']),
    name: text(100).min(2),
    description: text(500),
    format: z.enum(['office', 'outing', 'either']),
    city: text(100).min(2),
    tags: z.array(z.enum(interests)).min(1).max(8),
    duration: z.number().int().min(15).max(480),
    minPeople: z.number().int().min(1).max(60),
    maxPeople: z.number().int().min(1).max(500),
    perPerson: z.number().int().min(0).max(1000000),
    fixedCost: z.number().int().min(0).max(10000000),
    stepFree: z.enum(['yes', 'no', 'unknown']),
    diets: z.array(z.enum(diets)).max(4),
    indoor: z.boolean(),
    sourceUrl: text(1000).refine(
      (v) => v === '' || (/^https?:\/\//i.test(v) && URL.canParse(v)),
      'Use an http or https link.',
    ),
    details: text(1000),
  })
  .refine((i) => i.maxPeople >= i.minPeople, {
    message: 'Maximum group size must cover the minimum.',
    path: ['maxPeople'],
  });
export const feedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  repeat: z.boolean(),
  note: text(600),
});
export const versionSchema = z.number().int().min(0);
