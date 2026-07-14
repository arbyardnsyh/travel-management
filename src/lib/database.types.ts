// =============================================================================
// Hand-authored TypeScript types mirroring supabase/migrations/*.sql
// Regenerate with `npm run db:types` once the project is linked to Supabase
// CLI for a fully generated version — this file is a safe, complete
// hand-written baseline so the app is type-safe from day one.
// =============================================================================

import type { ActivityAction, ActivityEntity } from './constants';

export type UserRole = 'admin' | 'editor';
export type ContentStatus = 'draft' | 'published' | 'archived';
export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';
export type ModerationStatus = 'pending' | 'approved' | 'rejected';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Destination {
  id: string;
  name: string;
  slug: string;
  location: string;
  price: number;
  duration: string | null;
  rating: number;
  description: string | null;
  thumbnail: string | null;
  cover_image: string | null;
  is_featured: boolean;
  status: ContentStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  /** Soft-delete marker (Enhancement Batch). Null = not deleted. */
  deleted_at: string | null;
}

export interface DestinationGalleryItem {
  id: string;
  destination_id: string;
  image_url: string;
  caption: string | null;
  sort_order: number;
  created_at: string;
}

export interface Tour {
  id: string;
  destination_id: string | null;
  title: string;
  slug: string;
  price: number;
  duration: string | null;
  quota: number;
  description: string | null;
  thumbnail: string | null;
  status: ContentStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  /** Soft-delete marker (Enhancement Batch). Null = not deleted. */
  deleted_at: string | null;
  // populated via join in queries
  destination?: Pick<Destination, 'id' | 'name' | 'slug' | 'location'> | null;
}

export interface Booking {
  id: string;
  tour_id: string;
  customer_name: string;
  customer_email: string;
  phone: string;
  participants: number;
  travel_date: string;
  notes: string | null;
  status: BookingStatus;
  created_at: string;
  updated_at: string;
  /** Soft-delete marker (Batch 3A-5). Null = not deleted. */
  deleted_at: string | null;
  tour?:
    | (Pick<Tour, 'id' | 'title' | 'slug' | 'price'> & {
        destination_id?: string | null;
        destination?: Pick<Destination, 'id' | 'name' | 'slug'> | null;
      })
    | null;
}

export interface Testimonial {
  id: string;
  name: string;
  job: string | null;
  photo: string | null;
  rating: number;
  message: string;
  status: ModerationStatus;
  created_at: string;
  updated_at: string;
  /** Soft-delete marker (Batch 3A-4). Null = not deleted. */
  deleted_at: string | null;
}

export interface GalleryItem {
  id: string;
  title: string;
  image_url: string;
  category: string | null;
  created_at: string;
  /** Soft-delete marker (Enhancement Batch). Null = not deleted. */
  deleted_at: string | null;
}

export interface BlogCategory {
  id: string;
  name: string;
  slug: string;
}

export interface Blog {
  id: string;
  category_id: string | null;
  title: string;
  slug: string;
  thumbnail: string | null;
  content: string | null;
  author: string | null;
  published_at: string | null;
  status: ContentStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  /** Soft-delete marker (Enhancement Batch). Null = not deleted. */
  deleted_at: string | null;
  category?: BlogCategory | null;
}

export interface Faq {
  id: string;
  question: string;
  answer: string;
  sort_order: number;
  status: ContentStatus;
  created_at: string;
  updated_at: string;
  /** Soft-delete marker (Batch 3A-4). Null = not deleted. */
  deleted_at: string | null;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  is_read: boolean;
  created_at: string;
  /** Soft-delete marker (Batch 3A-11). Null = not deleted. */
  deleted_at: string | null;
}

export interface SiteSettings {
  id: string;
  website_name: string;
  logo: string | null;
  favicon: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  facebook: string | null;
  instagram: string | null;
  youtube: string | null;
  whatsapp: string | null;
  hero_title: string | null;
  hero_subtitle: string | null;
  hero_image: string | null;
  updated_at: string;
}

export interface StaticPage {
  id: string;
  slug: 'about' | 'privacy' | 'terms' | string;
  title: string;
  content: string | null;
  meta_title: string | null;
  meta_description: string | null;
  /** Added in 0009_pages_publish_status.sql (Batch 3A-7) to support the Publish feature. */
  status: ContentStatus;
  published_at: string | null;
  updated_at: string;
}

// Generic pagination result shape used by all admin list queries.
export interface Paginated<T> {
  data: T[];
  count: number;
  page: number;
  perPage: number;
  totalPages: number;
}

// =============================================================================
// Enhancement Batch — activity_logs (supabase/migrations/0005_activity_logs.sql)
// =============================================================================

export interface ActivityLog {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  action: ActivityAction;
  entity: ActivityEntity | string;
  entity_id: string | null;
  description: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}
