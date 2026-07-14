// =============================================================================
// Dashboard service (Batch 3A-10) — composes the `/admin/dashboard` page's
// stats/charts/recent-activity data out of the *other* services' functions
// (never queries Supabase directly itself). This keeps a single source of
// truth per entity (e.g. booking status counts still live in
// `booking.service.ts`, right next to `listBookings()`) while giving the
// Dashboard page one place to call instead of orchestrating a dozen
// individual imports + `Promise.all()` blocks itself.
//
// Per the master prompt: "Jangan melakukan query langsung di halaman
// Dashboard" — every function below only calls other `src/services/*`
// exports, so the page itself never touches `supabase.from(...)`.
// =============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { BookingStatus, ContentStatus, UserRole } from '@/lib/database.types';
import { countDestinations } from './destination.service';
import { countTours } from './tour.service';
import { getBookingStatusBreakdown, getBookingsPerMonth, getPopularDestinations, getPopularTours, listBookings } from './booking.service';
import { countGalleryItems } from './gallery.service';
import { countTestimonials, listTestimonials } from './testimonial.service';
import { countFaqs } from './faq.service';
import { countBlogs, getBlogPublishStats } from './blog.service';
import { countAllBlogCategories } from './blog-category.service';
import { countUsers, getUserRoleBreakdown } from './user.service';
import { countContacts, countUnreadContacts, listContactMessages } from './contact.service';
import { listActivityLogs } from './activity-log.service';

export interface DashboardStats {
  destinations: number;
  tours: number;
  bookings: {
    total: number;
    pending: number;
    confirmed: number;
    completed: number;
    cancelled: number;
  };
  gallery: number;
  testimonials: number;
  faq: number;
  blogArticles: number;
  blogCategories: number;
  users: number;
  contacts: number;
  /** Unread contact messages — powers the Dashboard "Unread Messages" stat card (Batch 3A-11). */
  unreadContacts: number;
}

/** All Statistics stat-card figures in one call — see master prompt "STATISTICS" section. */
export async function getDashboardStats(supabase: SupabaseClient): Promise<DashboardStats> {
  const [destinations, tours, bookingStatus, gallery, testimonials, faq, blogArticles, blogCategories, users, contacts, unreadContacts] =
    await Promise.all([
      countDestinations(supabase),
      countTours(supabase),
      getBookingStatusBreakdown(supabase),
      countGalleryItems(supabase),
      countTestimonials(supabase),
      countFaqs(supabase),
      countBlogs(supabase),
      countAllBlogCategories(supabase),
      countUsers(supabase),
      countContacts(supabase),
      countUnreadContacts(supabase),
    ]);

  const bookingTotal = (Object.values(bookingStatus) as number[]).reduce((sum, n) => sum + n, 0);

  return {
    destinations,
    tours,
    bookings: {
      total: bookingTotal,
      pending: bookingStatus.pending ?? 0,
      confirmed: bookingStatus.confirmed ?? 0,
      completed: bookingStatus.completed ?? 0,
      cancelled: bookingStatus.cancelled ?? 0,
    },
    gallery,
    testimonials,
    faq,
    blogArticles,
    blogCategories,
    users,
    contacts,
    unreadContacts,
  };
}

export interface DashboardCharts {
  bookingsPerMonth: Array<{ month: string; count: number }>;
  bookingStatus: Record<BookingStatus, number>;
  popularDestinations: Array<{ name: string; count: number }>;
  popularTours: Array<{ title: string; count: number }>;
  blogPublishStatus: Record<ContentStatus, number>;
  userRoles: Record<UserRole, number>;
}

/** All Charts data in one call — see master prompt "CHARTS" section. */
export async function getDashboardCharts(supabase: SupabaseClient): Promise<DashboardCharts> {
  const [bookingsPerMonth, bookingStatus, popularDestinations, popularTours, blogPublishStatus, userRoles] = await Promise.all([
    getBookingsPerMonth(supabase, 6),
    getBookingStatusBreakdown(supabase),
    getPopularDestinations(supabase, 5),
    getPopularTours(supabase, 5),
    getBlogPublishStats(supabase),
    getUserRoleBreakdown(supabase),
  ]);

  return { bookingsPerMonth, bookingStatus, popularDestinations, popularTours, blogPublishStatus, userRoles };
}

export interface DashboardRecent {
  bookings: Awaited<ReturnType<typeof listBookings>>['data'];
  contacts: Awaited<ReturnType<typeof listContactMessages>>['data'];
  testimonials: Awaited<ReturnType<typeof listTestimonials>>['data'];
  activityLogs: Awaited<ReturnType<typeof listActivityLogs>>['data'];
}

/** All "Recent" list data in one call — see master prompt "RECENT" section. Each list is capped at `limit` rows, newest first (services' default order). */
export async function getDashboardRecent(supabase: SupabaseClient, limit = 5): Promise<DashboardRecent> {
  const [bookings, contacts, testimonials, activityLogs] = await Promise.all([
    listBookings(supabase, { page: 1, perPage: limit }),
    listContactMessages(supabase, { page: 1, perPage: limit }),
    listTestimonials(supabase, { page: 1, perPage: limit }),
    listActivityLogs(supabase, { page: 1, perPage: limit }),
  ]);

  return {
    bookings: bookings.data,
    contacts: contacts.data,
    testimonials: testimonials.data,
    activityLogs: activityLogs.data,
  };
}
