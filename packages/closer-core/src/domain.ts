/**
 * The host part of a homepage, when there is one worth keeping.
 *
 * The domain is what makes a company one company across two discoveries, so a
 * wrong one splits an account in half. Code-hosting and documentation hosts are
 * refused rather than stored: `github.io` is where a project publishes, not who
 * builds it, and treating it as an identity would merge every project on it.
 */
const NOT_A_COMPANY_HOST =
  /(^|\.)(github\.io|github\.com|gitlab\.io|netlify\.app|vercel\.app|pages\.dev|readthedocs\.io|herokuapp\.com)$/i;

export function companyDomain(homepage: string | null): string | null {
  if (!homepage) return null;
  try {
    const url = new URL(
      homepage.startsWith('http') ? homepage : `https://${homepage}`,
    );
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (NOT_A_COMPANY_HOST.test(host)) return null;
    if (!host.includes('.')) return null;
    return host;
  } catch {
    return null;
  }
}
