'use client';

import { useToast } from '@localize-infra/ui';
import { useEffect, useRef } from 'react';

/**
 * The one place this product raises a toast.
 *
 * `deleteProject` ends in a `redirect` to this list, so the surface that could
 * have carried an inline message — the Danger Zone, with its `<Alert>` — no
 * longer exists when the result does. What the reader gets instead is a list
 * that is one row shorter, which is an *absence*, and an absence is not
 * evidently anyone's doing. The rest of the product keeps its inline feedback:
 * saving locales says "Saved." next to the button, and resolving an ambiguity
 * is reported by the queue visibly shortening (DESIGN.md §7.2).
 *
 * The slug is checked before it is shown. `github-result.tsx` learned this on
 * the same page: a query string is written by whoever sends the link, so
 * echoing it puts their text on the page. This one matches the shape the
 * database enforces — `^[a-z0-9]+(-[a-z0-9]+)*$`, 2 to 48 characters, see
 * `supabase/migrations` — and falls back to the unnamed sentence otherwise,
 * rather than declining to say anything.
 */
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function names(slug: string): boolean {
  return slug.length >= 2 && slug.length <= 48 && SLUG.test(slug);
}

export function DeletedToast({ slug }: { slug: string | undefined }) {
  const toast = useToast();
  const announced = useRef(false);

  useEffect(() => {
    if (!slug || announced.current) return;
    announced.current = true;

    toast({
      tone: 'success',
      title: names(slug) ? `Deleted ${slug}` : 'Project deleted',
      description:
        'Everything this workspace recorded about it is gone. Pull requests already opened on GitHub are untouched.',
    });

    // Drop the parameter once it has been said. Otherwise a refresh — or a
    // shared link — re-announces a deletion that happened once, which is the
    // display trap this repository has already been caught by on run lists.
    const url = new URL(window.location.href);
    url.searchParams.delete('deleted');
    window.history.replaceState(null, '', url.toString());
  }, [slug, toast]);

  return null;
}
