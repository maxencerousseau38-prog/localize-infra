import { AppSidebar } from '@/components/app-sidebar';
import { AppTopbar } from '@/components/app-topbar';
import { ThemeScript, TooltipProvider } from '@localize-infra/ui';
import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
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

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
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
  // Set per request in src/middleware.ts. Reading it here is what forces this
  // app to render dynamically — the deliberate cost of a strict CSP on a
  // surface that will render user data.
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable}`}
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
