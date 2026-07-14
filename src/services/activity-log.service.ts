// =============================================================================
// Activity log service — read access to `activity_logs`
// (supabase/migrations/0005_activity_logs.sql). Writing is handled by
// `src/lib/activity-log.ts#logActivity()`, called automatically from every
// other service's create/update/delete function — this file only covers
// listing, for a future "Activity Log" admin page.
// =============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ActivityLog, Paginated } from '@/lib/database.types';
import type { ActivityEntity } from '@/lib/constants';
import { resolvePageParams, toPaginated, throwIfError, type BaseListParams } from './_shared';

export interface ListActivityLogsParams extends BaseListParams {
  action?: string;
  entity?: ActivityEntity | string;
  entityId?: string;
  actorId?: string;
}

export async function listActivityLogs(
  supabase: SupabaseClient,
  params: ListActivityLogsParams = {}
): Promise<Paginated<ActivityLog>> {
  const { page, perPage, from, to } = resolvePageParams(params);

  let query = supabase.from('activity_logs').select('*', { count: 'exact' });
  if (params.action) query = query.eq('action', params.action);
  if (params.entity) query = query.eq('entity', params.entity);
  if (params.entityId) query = query.eq('entity_id', params.entityId);
  if (params.actorId) query = query.eq('actor_id', params.actorId);
  if (params.q) query = query.ilike('description', `%${params.q}%`);

  const { data, count, error } = await query.order('created_at', { ascending: false }).range(from, to);
  throwIfError(error);
  return toPaginated(data as ActivityLog[] | null, count, page, perPage);
}
