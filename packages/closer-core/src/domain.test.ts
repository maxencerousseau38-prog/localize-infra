import { describe, expect, it } from 'vitest';
import { companyDomain } from './domain.js';

describe('companyDomain', () => {
  it('takes the host from a homepage', () => {
    expect(companyDomain('https://acme.com/product')).toBe('acme.com');
  });

  it('drops www, so one company is one domain', () => {
    expect(companyDomain('https://www.acme.com')).toBe('acme.com');
    expect(companyDomain('https://acme.com')).toBe('acme.com');
  });

  it('accepts a bare host, which GitHub allows in that field', () => {
    expect(companyDomain('acme.com')).toBe('acme.com');
  });

  it('lowercases, because the database stores it lowercased', () => {
    expect(companyDomain('https://ACME.com')).toBe('acme.com');
  });

  /*
   * The one that keeps accounts from merging.
   *
   * The domain is what makes a company one company across two discoveries, so
   * a wrong one fuses two. `github.io` is where a project publishes, not who
   * builds it — accepting it would file every project hosted there under a
   * single account.
   */
  it.each([
    'https://acme.github.io/docs',
    'https://acme.vercel.app',
    'https://acme.netlify.app',
    'https://acme.pages.dev',
    'https://acme.readthedocs.io',
    'https://acme.herokuapp.com',
    'https://github.com/acme/thing',
  ])('refuses %s, which is a host and not a company', (url) => {
    expect(companyDomain(url)).toBeNull();
  });

  it('keeps a company domain that merely contains a hosting word', () => {
    // `mygithub.io` is not `github.io`; the pattern is anchored to a boundary.
    expect(companyDomain('https://mygithubio.com')).toBe('mygithubio.com');
  });

  it('refuses nonsense rather than storing it', () => {
    expect(companyDomain(null)).toBeNull();
    expect(companyDomain('')).toBeNull();
    expect(companyDomain('not a url at all')).toBeNull();
    expect(companyDomain('localhost')).toBeNull();
  });

  it('refuses a scheme that is not http', () => {
    expect(companyDomain('javascript:alert(1)')).toBeNull();
    expect(companyDomain('ftp://acme.com')).toBeNull();
  });
});
