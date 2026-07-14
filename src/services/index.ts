// =============================================================================
// Barrel export — `import { listDestinations, createBooking } from '@/services'`
// instead of reaching into individual files. Individual imports
// (`@/services/destination.service`) still work fine too.
// =============================================================================

export * from './destination.service';
export * from './tour.service';
export * from './booking.service';
export * from './blog.service';
export * from './blog-category.service';
export * from './gallery.service';
export * from './faq.service';
export * from './testimonial.service';
export * from './contact.service';
export * from './page.service';
export * from './settings.service';
export * from './user.service';
export * from './activity-log.service';
export * from './dashboard.service';
