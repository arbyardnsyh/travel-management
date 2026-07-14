// =============================================================================
// Activity logging helper (Enhancement Batch).
//
// Every admin CRUD action performed through `src/services/*` calls
// `logActivity()` so `activity_logs` (supabase/migrations/0005_activity_logs.sql)
// stays populated automatically — individual Batch 3 API routes don't need to
// remember to log anything themselves.
//
// Logging is intentionally "best effort": if the insert fails (e.g. RLS,
// network hiccup) we swallow the error instead of failing the CRUD operation
// that triggered it. An audit trail gap is far less harmful than blocking a
// user's save because logging failed.
// =============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ActivityAction, ActivityEntity } from './constants';
import type { UserProfile } from './database.types';

export interface LogActivityParams {
  /** The signed-in staff member performing the action (Astro.locals.user). Pass null for system/anonymous actions. */
  actor: UserProfile | null;
  action: ActivityAction;
  entity: ActivityEntity | string;
  entityId?: string | null;
  /** Short human-readable summary, e.g. `Menghapus destinasi "Bali"`. */
  description?: string;
  /** Extra structured context (old/new values, diffs, etc). */
  metadata?: Record<string, unknown>;
}

export async function logActivity(supabase: SupabaseClient, params: LogActivityParams): Promise<void> {
  try {
    await supabase.from('activity_logs').insert({
      actor_id: params.actor?.id ?? null,
      actor_name: params.actor?.name ?? null,
      action: params.action,
      entity: params.entity,
      entity_id: params.entityId ?? null,
      description: params.description ?? null,
      metadata: params.metadata ?? null,
    });
  } catch {
    // Best-effort — never let logging break the calling CRUD operation.
  }
}
