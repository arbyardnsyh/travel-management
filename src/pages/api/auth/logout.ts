import type { APIRoute } from 'astro';
import { logout } from '@/lib/auth';

export const prerender = false;

export const POST: APIRoute = async ({ cookies, redirect }) => {
  await logout(cookies);
  return redirect('/login');
};

// Allow GET too, so a plain <a href="/api/auth/logout"> link also works.
export const GET: APIRoute = async ({ cookies, redirect }) => {
  await logout(cookies);
  return redirect('/login');
};
