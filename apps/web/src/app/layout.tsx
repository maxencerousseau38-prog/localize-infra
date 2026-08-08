import { AppSidebar } from '@/components/app-sidebar';
import { AppTopbar } from '@/components/app-topbar';
import { ThemeScript, TooltipProvider } from '@localize-infra/ui';
import type { Metadata, Viewport } from 'next';
import {
  Archivo,
  Inter,
  JetBrains_Mono,
  Noto_Sans_Arabic,
  Noto_Sans_JP,
} from 'next/font/google';
import { headers } from 'next/headers';
import type * as React from 'react';
import './globals.css';

// `display: swap` so text is readable during font load; variable names match
// the contracts in packages/ui/src/styles/tokens.css.
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

/**
 * Display face. Titles only — never body copy.
 *
 * Deliberately not the interface face: Inter is the right UI font here and the
 * wrong display font, because Inter at display sizes is the default every
 * templated product lands on. See docs/design/09-app-design-direction.md §7.
 */
const archivo = Archivo({
  subsets: ['latin'],
  variable: '--font-archivo',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

/**
 * Script fonts for translated copy.
 *
 * These complete the `--font-jp` / `--font-ar` stacks in tokens.css, which
 * would otherwise resolve past an undefined variable straight to Inter — and
 * Inter has no CJK or Arabic glyphs, so the browser silently substitutes a
 * system font. That is the exact failure the token file warns about: rendering
 * Japanese in a Latin-first fallback is the fastest way for a localization
 * product to prove it does not care.
 *
 * Loading them here rather than in packages/ui is deliberate — next/font must
 * be called from the app that owns the document. apps/site does not load them
 * because it renders no translated copy.
 *
 * Google splits these into unicode-range chunks and next/font preserves that,
 * so a page showing three Japanese characters fetches one small chunk, not the
 * whole face. The JS budget test in e2e/perf.spec.ts keeps that honest.
 */
const notoSansJP = Noto_Sans_JP({
  // No `subsets`, deliberately. Google exposes no named Japanese subset for
  // this face — CJK is delivered as unicode-range chunks — so naming a subset
  // here yields a font with no CJK glyphs at all, and the stack falls silently
  // through to a system font. That is invisible in the computed font-family;
  // it was caught by measuring rendered glyph widths, and a test now pins it.
  //
  // `preload: false` follows from the same fact: there is no single file to
  // preload, and preloading every chunk would cost far more than it saves.
  preload: false,
  variable: '--font-noto-jp',
  display: 'swap',
});

const notoSansArabic = Noto_Sans_Arabic({
  subsets: ['arabic'],
  variable: '--font-noto-ar',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Localize Infra',
    template: '%s · Localize Infra',
  },
  description: 'Localization infrastructure for product teams.',
  // The app is not public content. Indexing it would surface screens that
  // announce their own absence, which is honest but not useful in search.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0c0e12' },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Set per request in src/proxy.ts. Reading it here is what forces this
  // app to render dynamically — the deliberate cost of a strict CSP on a
  // surface that will render user data.
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${archivo.variable} ${jetbrainsMono.variable} ${notoSansJP.variable} ${notoSansArabic.variable}`}
    >
      <head>
        <ThemeScript nonce={nonce} />
      </head>
      <body className="antialiased">
        {/* First focusable element on the page: keyboard and screen-reader
            users should not have to traverse the whole shell to reach content. */}
        <a
          href="#main"
          className="sr-only rounded-md bg-primary px-4 py-2 text-inverse focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50"
        >
          Skip to content
        </a>
        <TooltipProvider delayDuration={400}>
          <div className="flex h-dvh overflow-hidden">
            <AppSidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <AppTopbar />
              <main id="main" className="flex-1 overflow-y-auto">
                {children}
              </main>
            </div>
          </div>
        </TooltipProvider>
      </body>
    </html>
  );
}
