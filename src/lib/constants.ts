// =============================================================================
// Centralized constants — status enums, storage rules, pagination defaults.
// Extracted so `src/lib/helpers.ts`, `src/utils/*`, `src/services/*` and
// future Batch 2/3 pages/API routes all read from a single source instead of
// repeating magic numbers/strings.
// =============================================================================

import type { BookingStatus, ContentStatus, ModerationStatus } from './database.types';

/** Values allowed for `content_status` enum columns (destinations, tours, blogs, faq). */
export const CONTENT_STATUSES: ContentStatus[] = ['draft', 'published', 'archived'];

/** Values allowed for `booking_status` enum column. */
export const BOOKING_STATUSES: BookingStatus[] = ['pending', 'confirmed', 'completed', 'cancelled'];

/** Values allowed for `moderation_status` enum column (testimonials). */
export const MODERATION_STATUSES: ModerationStatus[] = ['pending', 'approved', 'rejected'];

/** Roles recognized by `public.users.role`. */
export const USER_ROLES = ['admin', 'editor'] as const;

/**
 * Storage sub-folders inside the shared `media` bucket (see 0003_storage_buckets.sql).
 * `avatar` added in Batch 3A-8 for the Profile page's avatar upload — the
 * bucket/policies are already generic (any staff-writable folder works, see
 * 0003_storage_buckets.sql), so this is a constants-only addition, no new
 * migration needed.
 */
export const IMAGE_FOLDERS = ['destination', 'tour', 'gallery', 'blog', 'logo', 'testimonial', 'hero', 'avatar'] as const;
export type ImageFolder = (typeof IMAGE_FOLDERS)[number];

/** Image upload constraints, shared by `utils/storage.ts` and the Zod schemas. */
export const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

/** Pagination defaults, shared by `utils/pagination.ts` and services. */
export const DEFAULT_PAGE = 1;
export const DEFAULT_PER_PAGE = 10;
export const MAX_PER_PAGE = 100;

/**
 * Actions recorded in `activity_logs.action`. Kept as a union (not a DB enum)
 * so new action types can be added without a migration.
 */
export const ACTIVITY_ACTIONS = [
  'create',
  'update',
  'soft_delete',
  'restore',
  'delete',
  'status_change',
  'login',
  'logout',
  // Added in Batch 3A-8 (Users & Profile) so password-related events are
  // distinguishable in the Activity Log from a plain profile field 'update'.
  'reset_password',
  'change_password',
  // Added in Batch 3A-11 (Contact Management) — read/unread are more
  // specific than a generic 'update' for the contacts Activity Log, and
  // 'permanent_delete' distinguishes hard delete from 'soft_delete' /
  // 'delete' per the master prompt's ACTIVITY LOG section.
  'read',
  'unread',
  'permanent_delete',
] as const;
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

/** Tables/modules that emit activity logs. Extend as new modules are added in Batch 3. */
export const ACTIVITY_ENTITIES = [
  'destinations',
  'tours',
  'bookings',
  'blogs',
  'blog_categories',
  'gallery',
  'faq',
  'testimonials',
  'contacts',
  'settings',
  'pages',
  'users',
] as const;
export type ActivityEntity = (typeof ACTIVITY_ENTITIES)[number];
