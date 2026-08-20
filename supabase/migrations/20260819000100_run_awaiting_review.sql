-- A run can now stop and wait for a person.
--
-- 'awaiting_review' is not a failure and not a success: the pipeline did
-- exactly what it should — it found something it refused to guess at — and the
-- next move belongs to a human. Without this state the only honest options
-- were to fail the run or to guess, and the product exists to do neither.
alter type public.run_status add value if not exists 'awaiting_review';
