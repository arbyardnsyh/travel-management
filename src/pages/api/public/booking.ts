import type { APIRoute } from 'astro';
import { bookingPublicSchema } from '@/lib/validation/booking.schema';
import { parseFormData, parseJsonBody } from '@/utils/parse-form';
import { jsonOk, jsonError } from '@/utils/response';
import { createBooking } from '@/services';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const supabase = locals.supabase;
  const contentType = request.headers.get('content-type') || '';

  const result = contentType.includes('application/json')
    ? parseJsonBody(await request.json(), bookingPublicSchema)
    : parseFormData(await request.formData(), bookingPublicSchema);

  if (!result.success) {
    return jsonError(JSON.stringify(result.fieldErrors), 422);
  }

  try {
    const booking = await createBooking(supabase, result.data);
    return jsonOk(booking, 201);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Gagal menyimpan booking.', 500);
  }
};
