import type { APIRoute } from 'astro';
import { testimonialPublicSchema } from '@/lib/validation/testimonial.schema';
import { parseFormData, parseJsonBody } from '@/utils/parse-form';
import { jsonOk, jsonError } from '@/utils/response';
import { createTestimonial } from '@/services';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const supabase = locals.supabase;
  const contentType = request.headers.get('content-type') || '';

  const result = contentType.includes('application/json')
    ? parseJsonBody(await request.json(), testimonialPublicSchema)
    : parseFormData(await request.formData(), testimonialPublicSchema);

  if (!result.success) {
    return jsonError(JSON.stringify(result.fieldErrors), 422);
  }

  try {
    const testimonial = await createTestimonial(supabase, result.data);
    return jsonOk(testimonial, 201);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Gagal mengirim testimoni.', 500);
  }
};
