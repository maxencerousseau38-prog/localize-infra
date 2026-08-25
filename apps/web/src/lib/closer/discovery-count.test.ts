import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * What a discovery run is allowed to call "recorded".
 *
 * One rule, and it was wrong: `recorded` incremented for every company whose
 * row was written, whether or not the lead behind it opened. A company that
 * had opted out therefore counted toward the total of a run that had recorded
 * nothing usable — the count said the opposite of what it meant.
 *
 * Found by a production smoke test. This pins it, because the failing branch is
 * unreachable from the outside once the fix is in: nothing else distinguishes a
 * run that recorded two companies from one that recorded two rows.
 *
 * Everything the action reaches for is mocked, which limits what this proves.
 * It does not prove discovery works; it proves the arithmetic of its summary.
 * The guards themselves are exercised against a real database in
 * `supabase/tests/closer-suppression.sql`.
 *
 * It lives under `src/lib` rather than beside the action because that is what
 * this workspace's vitest config collects. Moving the file was the smaller
 * change than widening the glob.
 */

const openLead = vi.fn();
const upsertCompany = vi.fn();

vi.mock('@/lib/data/workspace', () => ({
  requireSession: async () => ({ userId: 'user-1', email: 'op@test.invalid' }),
}));

vi.mock('@/lib/closer/access', () => ({
  closerOrganizationId: async () => 'org-1',
}));

vi.mock('next/cache', () => ({ revalidatePath: () => {} }));

vi.mock('@/lib/closer/drafting', () => ({ draftMessageForLead: vi.fn() }));
vi.mock('@/lib/closer/research', () => ({ researchRepository: vi.fn() }));
vi.mock('@/lib/closer/funnel', () => ({
  advanceLead: vi.fn(),
  leadForCompany: vi.fn(),
}));

const candidate = (fullName: string) => ({
  fullName,
  owner: fullName.split('/')[0] as string,
  repo: fullName.split('/')[1] as string,
  description: null,
  homepage: `https://${fullName.split('/')[0]}.test.invalid`,
  stars: 10,
  pushedAt: '2026-08-01T00:00:00Z',
  defaultBranch: 'main',
});

vi.mock('@/lib/closer/discovery', () => ({
  searchCandidates: async () => [candidate('alpha/app'), candidate('beta/app')],
  inspectRepository: async (_org: string, c: { fullName: string }) => ({
    ...candidate(c.fullName),
    signals: [{ label: 'next-intl', summary: 'dependency', confidence: null }],
    locales: ['fr', 'de'],
    qualifies: true,
  }),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    rpc: (name: string, args: Record<string, unknown>) => {
      if (name === 'closer_upsert_company') return upsertCompany(args);
      if (name === 'closer_open_lead') return openLead(args);
      // Evidence writes are not what this measures.
      return Promise.resolve({ data: { id: 'ignored' }, error: null });
    },
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  let n = 0;
  upsertCompany.mockImplementation(() => {
    n += 1;
    return Promise.resolve({
      data: { id: `company-${n}`, name: `c${n}` },
      error: null,
    });
  });
});

async function run() {
  const { discoverCompanies } = await import('@/app/closer/companies/actions');
  const form = new FormData();
  form.set('query', 'next-intl');
  return discoverCompanies({}, form);
}

describe('discoverCompanies — what counts as recorded', () => {
  it('counts a company only once its lead has opened', async () => {
    openLead.mockResolvedValue({ data: { id: 'lead' }, error: null });

    const state = await run();
    expect(state.summary?.recorded).toBe(2);
    expect(state.summary?.skipped).toEqual([]);
  });

  /*
   * The regression. `closer_open_lead` refuses a company whose contact has
   * opted out; before the fix that refusal was discarded and the company was
   * counted anyway.
   */
  it('does not count a company whose lead was refused', async () => {
    openLead
      .mockResolvedValueOnce({ data: { id: 'lead' }, error: null })
      .mockResolvedValueOnce({
        data: null,
        error: {
          message: 'a contact at this company has asked not to be contacted',
        },
      });

    const state = await run();
    expect(state.summary?.recorded).toBe(1);
    expect(state.summary?.skipped).toHaveLength(1);
  });

  it('says why it was skipped, rather than dropping it silently', async () => {
    openLead.mockResolvedValue({
      data: null,
      error: { message: 'this company is suppressed' },
    });

    const state = await run();
    expect(state.summary?.recorded).toBe(0);
    expect(state.summary?.skipped.join(' ')).toContain(
      'this company is suppressed',
    );
  });

  /*
   * The other half of the same rule: a company the upsert itself refuses — the
   * D2 fix, where a suppressed domain now raises — never reaches the lead step,
   * and must not be counted either.
   */
  it('does not count a company the upsert refused', async () => {
    upsertCompany.mockResolvedValue({
      data: null,
      error: { message: 'this company is suppressed' },
    });
    openLead.mockResolvedValue({ data: { id: 'lead' }, error: null });

    const state = await run();
    expect(state.summary?.recorded).toBe(0);
    expect(openLead).not.toHaveBeenCalled();
  });
});
