import type { APIRoute } from 'astro';
import { contactPublicSchema } from '@/lib/validation/contact.schema';
import { parseFormData, parseJsonBody } from '@/utils/parse-form';
import { jsonOk, jsonError } from '@/utils/response';
import { createContactMessage } from '@/services';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const supabase = locals.supabase;
  const contentType = request.headers.get('content-type') || '';

  const result = contentType.includes('application/json')
    ? parseJsonBody(await request.json(), contactPublicSchema)
    : parseFormData(await request.formData(), contactPublicSchema);

  if (!result.success) {
    return jsonError(JSON.stringify(result.fieldErrors), 422);
  }

  try {
    const message = await createContactMessage(supabase, result.data);
    return jsonOk(message, 201);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Gagal mengirim pesan.', 500);
  }
};
