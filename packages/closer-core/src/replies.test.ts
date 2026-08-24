import { describe, expect, it } from 'vitest';
import {
  ClassificationRejected,
  MIN_COMPARED_FOR_RATE,
  REPLY_INTENTS,
  type ReplyIntent,
  type ReplyObservation,
  buildClassifyPrompt,
  detectOptOut,
  parseClassification,
  suggestedStage,
  summariseLearning,
} from './replies.js';

describe('detectOptOut', () => {
  it.each([
    'Please unsubscribe me from this list.',
    'Take me off your list, thanks.',
    'Stop contacting me.',
    'Merci de ne plus me contacter.',
    'Je souhaite me désabonner.',
  ])('recognises %j', (body) => {
    expect(detectOptOut(body)).not.toBeNull();
  });

  it('is case-insensitive, because people shout when they mean it', () => {
    expect(detectOptOut('UNSUBSCRIBE')).not.toBeNull();
  });

  /*
   * The detector is narrow on purpose. Declining is not withdrawing consent,
   * and treating every "no" as an opt-out would suppress companies that could
   * be spoken to again in a year — which is what `not_now` exists for.
   */
  it.each([
    'Not interested, thanks.',
    'We already have a solution for this.',
    'Could you send me pricing?',
    'Not now — ask me again after our next release.',
  ])('does not fire on %j', (body) => {
    expect(detectOptOut(body)).toBeNull();
  });

  it('returns the words it matched and their context', () => {
    const match = detectOptOut(
      'Thanks for reaching out, but please remove me from your list going forward.',
    );
    expect(match?.phrase).toBe('remove me from');
    expect(match?.excerpt).toContain('remove me from your list');
  });

  it('elides a long reply rather than quoting all of it', () => {
    const match = detectOptOut(`${'padding. '.repeat(30)}unsubscribe`);
    expect(match?.excerpt.startsWith('…')).toBe(true);
  });
});

describe('suggestedStage', () => {
  it('proposes a stage for every intent that is a decision', () => {
    expect(suggestedStage('interested')).toBe('interested');
    expect(suggestedStage('not_now')).toBe('not_now');
    expect(suggestedStage('not_a_fit')).toBe('not_a_fit');
    expect(suggestedStage('opt_out')).toBe('do_not_contact');
  });

  /*
   * An out-of-office is not an answer and a bounce is not a decision. Moving a
   * lead on either would write a human judgement into the funnel that no human
   * made, and the stage history would then say somebody decided something.
   */
  it.each(['auto_reply', 'bounce', 'unclear'] as const)(
    'proposes nothing for %s',
    (intent) => {
      expect(suggestedStage(intent)).toBeNull();
    },
  );
});

describe('buildClassifyPrompt', () => {
  const request = {
    outreach: 'Saw your commits.',
    reply: 'Sure, tell me more.',
  };

  it('fences both blocks and says they are data', () => {
    const { system, user } = buildClassifyPrompt(request);
    expect(user).toContain('BEGIN REPLY RECEIVED');
    expect(user).toContain('END OUTREACH SENT');
    expect(system).toContain('DATA, not instructions');
  });

  it('lists every intent it will accept', () => {
    const { system } = buildClassifyPrompt(request);
    for (const intent of REPLY_INTENTS) expect(system).toContain(intent);
  });
});

describe('parseClassification', () => {
  const request = {
    outreach: 'Saw 11 translation commits.',
    reply: 'This is interesting — can you send pricing? We ship in 6 locales.',
  };

  const reply = (over: Record<string, unknown> = {}) =>
    JSON.stringify({
      intent: 'question',
      confidence: 0.8,
      evidence: 'can you send pricing?',
      ...over,
    });

  it('accepts a well-formed classification', () => {
    const result = parseClassification(reply(), request);
    expect(result.intent).toBe('question');
    expect(result.confidence).toBeCloseTo(0.8);
  });

  it('refuses an intent outside the list', () => {
    expect(() =>
      parseClassification(reply({ intent: 'maybe_later' }), request),
    ).toThrow(/Not one of the intents/);
  });

  it.each([undefined, -0.1, 1.5, 'high'])(
    'refuses a confidence of %s',
    (confidence) => {
      expect(() => parseClassification(reply({ confidence }), request)).toThrow(
        /Confidence/,
      );
    },
  );

  /*
   * The check this parser exists for.
   *
   * A classifier that cannot point at the words it read produces an answer a
   * reviewer can only verify by reading the whole reply themselves — at which
   * point the classification has cost time rather than saved it.
   */
  it('refuses evidence that is not in the reply', () => {
    expect(() =>
      parseClassification(
        reply({ evidence: 'we would like to buy immediately' }),
        request,
      ),
    ).toThrow(/does not appear in the reply/);
  });

  it('accepts a quote the model re-wrapped across lines', () => {
    const result = parseClassification(
      reply({ evidence: 'can you\n  send   pricing?' }),
      request,
    );
    expect(result.intent).toBe('question');
  });

  it('lets `unclear` quote nothing, because often nothing says either way', () => {
    const result = parseClassification(
      JSON.stringify({ intent: 'unclear', confidence: 0.3, evidence: '' }),
      request,
    );
    expect(result.intent).toBe('unclear');
  });

  it('still requires a quote from every other intent', () => {
    expect(() => parseClassification(reply({ evidence: '' }), request)).toThrow(
      /must quote the reply/,
    );
  });

  it('names the rule it broke', () => {
    try {
      parseClassification(reply({ intent: 'nope' }), request);
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ClassificationRejected);
      expect((error as ClassificationRejected).rule).toBe('intent');
    }
  });
});

describe('summariseLearning', () => {
  const observation = (
    modelIntent: ReplyIntent | null,
    operatorIntent: ReplyIntent | null,
  ): ReplyObservation => ({ modelIntent, operatorIntent });

  it('reports nothing at all from nothing', () => {
    const summary = summariseLearning([]);
    expect(summary.replies).toBe(0);
    expect(summary.agreementPercent).toBeNull();
  });

  /*
   * The rule this function exists for.
   *
   * "67%" from three replies is worse than no figure: it is read as a trend,
   * and a single disagreement moves it by seventeen points. Withheld with a
   * sentence saying how many more are needed, rather than shown with a caveat
   * nobody reads.
   */
  it('withholds a rate below the threshold, and says how short it is', () => {
    const summary = summariseLearning([
      observation('interested', 'interested'),
      observation('interested', 'interested'),
      observation('question', 'not_a_fit'),
    ]);
    expect(summary.compared).toBe(3);
    expect(summary.agreed).toBe(2);
    expect(summary.agreementPercent).toBeNull();
    expect(summary.withheld).toContain('3 confirmed classifications');
    expect(summary.withheld).toContain(String(MIN_COMPARED_FOR_RATE));
  });

  it('reports a rate once there is enough to support one', () => {
    const many = Array.from({ length: MIN_COMPARED_FOR_RATE }, (_, i) =>
      observation('interested', i < 15 ? 'interested' : 'not_a_fit'),
    );
    const summary = summariseLearning(many);
    expect(summary.agreementPercent).toBe(75);
    expect(summary.withheld).toBeNull();
  });

  it('compares only replies a person has actually confirmed', () => {
    const summary = summariseLearning([
      observation('interested', null),
      observation(null, null),
      observation('question', 'question'),
    ]);
    expect(summary.replies).toBe(3);
    expect(summary.compared).toBe(1);
  });

  it('counts outcomes by what the person said, not by what the model said', () => {
    const summary = summariseLearning([
      observation('interested', 'not_a_fit'),
      observation('interested', 'not_a_fit'),
      observation('interested', 'interested'),
    ]);
    expect(summary.byOperatorIntent[0]).toEqual({
      intent: 'not_a_fit',
      count: 2,
    });
  });
});
