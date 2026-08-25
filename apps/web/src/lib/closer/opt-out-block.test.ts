import { describe, expect, it } from 'vitest';
import {
  type OptOutInputs,
  optOutReason,
  suppressionSets,
} from './opt-out-block.js';

/**
 * The rule that decides whether an operator is offered text to send.
 *
 * Written after an audit found an approved message surviving an opt-out that
 * arrived later, and staying on the approvals screen with no warning. Nothing
 * in this repository sends, so the person copying the text out is the only real
 * send — and this decides what they are shown.
 */

const none = suppressionSets([]);

const inputs = (over: Partial<OptOutInputs> = {}): OptOutInputs => ({
  leadStage: 'outreach_approved',
  companyDomain: 'acme.example',
  contactEmail: 'robin@acme.example',
  ...over,
});

describe('optOutReason', () => {
  it('lets an ordinary message through', () => {
    expect(optOutReason(inputs(), none)).toBeNull();
  });

  it('blocks a lead that has stopped', () => {
    expect(
      optOutReason(inputs({ leadStage: 'do_not_contact' }), none),
    ).toContain('do-not-contact');
  });

  /*
   * The three signals are not redundant decoration. `closer_suppress` moves the
   * lead, so the stage is the usual signal — but a suppression whose lead
   * failed to move is exactly the case a stage check cannot see, and this
   * repository has already had that defect once.
   */
  it('blocks on a suppressed domain even when the stage did not move', () => {
    const suppressions = suppressionSets([
      { domain: 'acme.example', email: null },
    ]);
    const reason = optOutReason(inputs(), suppressions);
    expect(reason).toContain('acme.example');
  });

  it('blocks on a suppressed address even when the stage did not move', () => {
    const suppressions = suppressionSets([
      { domain: null, email: 'robin@acme.example' },
    ]);
    expect(optOutReason(inputs(), suppressions)).toContain(
      'robin@acme.example',
    );
  });

  it('matches regardless of case, because addresses arrive as people type them', () => {
    const suppressions = suppressionSets([
      { domain: null, email: 'Robin@Acme.Example' },
    ]);
    expect(
      optOutReason(
        inputs({ contactEmail: 'ROBIN@acme.example' }),
        suppressions,
      ),
    ).not.toBeNull();
  });

  it('does not block a different company on the same list', () => {
    const suppressions = suppressionSets([
      { domain: 'other.example', email: 'someone@other.example' },
    ]);
    expect(optOutReason(inputs(), suppressions)).toBeNull();
  });

  /*
   * A company with no domain is the early-stage team discovery exists to find.
   * Its lead and its contact still carry the signals; the missing domain must
   * not match a null entry on the list.
   */
  it('does not treat a missing domain as a match', () => {
    const suppressions = suppressionSets([
      { domain: null, email: 'x@y.example' },
    ]);
    expect(
      optOutReason(
        inputs({ companyDomain: null, contactEmail: null }),
        suppressions,
      ),
    ).toBeNull();
  });

  it('names which signal fired, so the operator can check it', () => {
    expect(optOutReason(inputs({ leadStage: 'do_not_contact' }), none)).toBe(
      'This lead is marked do-not-contact.',
    );
  });
});

describe('suppressionSets', () => {
  it('ignores the null half of each row', () => {
    const sets = suppressionSets([
      { domain: 'a.example', email: null },
      { domain: null, email: 'b@b.example' },
    ]);
    expect(sets.domains.size).toBe(1);
    expect(sets.emails.size).toBe(1);
  });

  it('lowercases both, so a match does not depend on how it was written', () => {
    const sets = suppressionSets([{ domain: 'A.Example', email: null }]);
    expect(sets.domains.has('a.example')).toBe(true);
  });
});
