// =============================================================================
// Temporary password generator — Batch 3A-8 (Users: Reset Password).
// Used only by `src/services/user.service.ts#resetUserPassword`, which sets
// this as the account's new Supabase Auth password (service role,
// `auth.admin.updateUserById`) and returns it once so the admin can hand it
// to the user out-of-band. Never persisted anywhere in `public.users`.
// =============================================================================

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I/O to avoid visual ambiguity
const LOWER = 'abcdefghijkmnpqrstuvwxyz';
const DIGITS = '23456789'; // no 0/1 to avoid confusion with O/I
const SYMBOLS = '!@#$%*?';
const ALL = UPPER + LOWER + DIGITS + SYMBOLS;

function randomChar(pool: string): string {
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Generates a random 12-character password guaranteed to contain upper/lower/digit/symbol. */
export function generateTempPassword(length = 12): string {
  const required = [randomChar(UPPER), randomChar(LOWER), randomChar(DIGITS), randomChar(SYMBOLS)];
  const rest = Array.from({ length: Math.max(0, length - required.length) }, () => randomChar(ALL));
  const chars = [...required, ...rest];
  // Fisher-Yates shuffle so the required chars aren't always in the same position.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
