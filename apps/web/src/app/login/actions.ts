'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

/**
 * Sign-in and sign-up as Server Actions.
 *
 * No client-side Supabase, which is what keeps `connect-src 'self'` intact in
 * the CSP and means the forms work before any JavaScript has loaded.
 *
 * Errors come back as a returned string rather than a thrown exception:
 * `useActionState` renders them next to the field, and a thrown error on a
 * wrong password would be an error page for an ordinary, expected event.
 */
export interface AuthState {
  error?: string;
  notice?: string;
}

/** Never echo which half of the pair was wrong — that enumerates accounts. */
const INVALID = 'That email and password combination is not recognised.';

function safeNext(next: FormDataEntryValue | null): string {
  const value = typeof next === 'string' ? next : '';
  // Only same-origin, absolute paths. `//evil.example` is a protocol-relative
  // URL that a browser treats as another origin, so a leading `//` is rejected
  // as firmly as a scheme.
  if (!value.startsWith('/') || value.startsWith('//')) return '/';
  return value;
}

export async function signIn(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const next = safeNext(formData.get('next'));

  if (!email || !password) return { error: 'Email and password are required.' };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { error: INVALID };
  // revalidatePath before redirect is not decoration. Without it the redirect
  // response is served from the router cache and the Set-Cookie headers written
  // by signInWithPassword never reach the browser — sign-in appears to succeed,
  // the redirect fires, and the proxy bounces the request straight back to
  // /login because there is still no session. Verified: without this line the
  // cookie is absent; with it, present.
  revalidatePath('/', 'layout');
  redirect(next);
}

export async function signUp(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) return { error: 'Email and password are required.' };
  // Supabase enforces its own minimum; stating ours up front avoids a
  // round-trip to be told the same thing.
  if (password.length < 8) {
    return { error: 'Use at least 8 characters.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email, password });

  if (error) return { error: error.message };

  // Deliberately identical whether or not the address was already registered.
  // A distinct "account exists" reply is an account-enumeration oracle.
  return {
    notice: 'Check your email for a confirmation link. It expires in an hour.',
  };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
