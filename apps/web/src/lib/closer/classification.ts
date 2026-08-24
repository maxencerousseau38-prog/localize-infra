import 'server-only';
import { createClient } from '@/lib/supabase/server';
import {
  type Classification,
  ClassificationRejected,
  buildClassifyPrompt,
  parseClassification,
} from '@localize-infra/closer-core';

/**
 * Reading a reply with a model, and never letting it decide anything alone.
 *
 * The classification is written to `model_intent`, which no action reads to
 * decide what happens next — `operator_intent` does, and only a signed-in
 * person can set it. The classifier's job is to put a proposal in front of
 * somebody, and the difference between the two columns is the only training
 * signal this system produces.
 *
 * Opt-out is deliberately not this function's business. It is detected without
 * a model in `closer-core`, at the moment the reply is recorded, so a bad day
 * for the classifier cannot become a compliance failure.
 */

const MODEL = 'claude-opus-5';

export function classificationModelConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function classifyReply(
  organizationId: string,
  replyId: string,
): Promise<Classification> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Classification is not available: no model key on this deployment',
    );
  }

  const supabase = await createClient();

  const { data: reply } = await supabase
    .from('closer_replies')
    .select(
      'id, body, company:closer_leads(company_id), message:closer_messages(body)',
    )
    .eq('id', replyId)
    .maybeSingle();
  if (!reply) throw new Error('No such reply in this workspace');

  const outreach =
    (reply.message as { body?: string } | null)?.body ??
    '(the outreach text is no longer available)';

  const request = { outreach, reply: reply.body as string };
  const { system, user } = buildClassifyPrompt(request);

  const startedAt = Date.now();
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Anthropic API error ${response.status}: ${await response.text()}`,
    );
  }

  const payload = (await response.json()) as {
    content: { type: string; text?: string }[];
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const raw = payload.content.find((part) => part.type === 'text')?.text ?? '';
  const latencyMs = Date.now() - startedAt;

  const record = async (output: unknown, error: string | null) => {
    await supabase.rpc('closer_record_ai_execution', {
      p_organization_id: organizationId,
      p_agent: 'reply_classification',
      p_model_id: MODEL,
      p_input: { replyId },
      p_output: output,
      p_input_tokens: payload.usage?.input_tokens ?? 0,
      p_output_tokens: payload.usage?.output_tokens ?? 0,
      p_latency_ms: latencyMs,
      p_error: error,
    });
  };

  let parsed: Classification;
  try {
    parsed = parseClassification(raw, request);
  } catch (error) {
    const reason =
      error instanceof ClassificationRejected
        ? `${error.rule}: ${error.message}`
        : String(error);
    await record({ raw: raw.slice(0, 2000) }, reason);
    throw new Error(`The classification was rejected — ${reason}`);
  }

  await record(parsed, null);

  const { error: writeError } = await supabase.rpc('closer_classify_reply', {
    p_reply_id: replyId,
    p_intent: parsed.intent,
    p_confidence: parsed.confidence,
    p_evidence: parsed.evidence,
    p_model: MODEL,
  });
  if (writeError) throw new Error(writeError.message);

  return parsed;
}
