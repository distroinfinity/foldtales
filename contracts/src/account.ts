import { z } from 'zod';

/**
 * Accounts and the reader's book. The device token stays in `Authorization` on every call, as
 * for a guest. A signed-in client adds its session token in this header, and only a valid
 * session makes the caller an account. A linked device is a record, never a key.
 */
export const SESSION_HEADER = 'x-tabletop-session';

/** Better Auth's own routes live under this path, outside the contract header check. */
export const AUTH_BASE_PATH = '/v1/auth';

/** The account routes. They carry the contract header and the device token like every app route. */
export const accountRoutes = {
  linkDevice: { method: 'POST', path: '/v1/me/devices' },
  getBook: { method: 'GET', path: '/v1/me/book' },
  putBook: { method: 'PUT', path: '/v1/me/book' },
} as const;

export const AccountUser = z.strictObject({
  id: z.string().min(1),
  name: z.string(),
  email: z.string(),
});
export type AccountUser = z.infer<typeof AccountUser>;

/** How far a chapter has been read. Merging only ever moves forward through this order. */
export const ChapterState = z.enum(['unread', 'started', 'finished']);
export type ChapterState = z.infer<typeof ChapterState>;

/** A chapter's number, as the book's key. */
export const ChapterKey = z.string().regex(/^[1-9][0-9]{0,2}$/);

/** Where the reader stopped inside a chapter. Null once it's finished, or before anything was started. */
export const ResumePoint = z.strictObject({
  chapter: z.number().int().positive(),
  savedAt: z.iso.datetime(),
});
export type ResumePoint = z.infer<typeof ResumePoint>;

/** One book per account, stored as one document with a revision number. */
export const Book = z.strictObject({
  chapters: z.record(ChapterKey, ChapterState),
  resume: ResumePoint.nullable(),
  /** Bumped by every accepted write. A new account's book is revision 0. */
  rev: z.number().int().nonnegative(),
  updatedAt: z.iso.datetime(),
});
export type Book = z.infer<typeof Book>;

/** `PUT /v1/me/book`. Refused with `StaleBookError` (409) unless `baseRev` is the stored revision. */
export const BookPut = z.strictObject({
  baseRev: z.number().int().nonnegative(),
  chapters: z.record(ChapterKey, ChapterState),
  resume: ResumePoint.nullable(),
});
export type BookPut = z.infer<typeof BookPut>;

/** The 409 for a stale `baseRev`. The client fetches, merges and retries. */
export const StaleBookError = z.strictObject({
  error: z.strictObject({ code: z.literal('stale_rev'), retryable: z.literal(true), message: z.string() }),
});
export type StaleBookError = z.infer<typeof StaleBookError>;

/** `POST /v1/me/devices`, with a valid session and the device token: records that this headset signed in. */
export const DeviceLinkRequest = z.strictObject({
  label: z.string().min(1).max(80).optional(),
});
export type DeviceLinkRequest = z.infer<typeof DeviceLinkRequest>;

export const DeviceLinkResponse = z.strictObject({ linked: z.literal(true) });
export type DeviceLinkResponse = z.infer<typeof DeviceLinkResponse>;
