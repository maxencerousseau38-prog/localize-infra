/**
 * Whether what somebody typed confirms deleting this project.
 *
 * Deleting a project cascades: `runs`, `run_translations` and `run_ambiguities`
 * all carry `on delete cascade`, so this removes every run the project ever had
 * and everything recorded against them. On the only project that exists today
 * that is 8 runs and 72 proposals.
 *
 * So the control exists to cost a deliberate act, and every loosening defeats
 * it. Case is not forgiven — accepting `DEMO` for `demo` turns the box into a
 * formality. Only surrounding whitespace is, because a paste or a double-click
 * adds it and the person did type the right thing.
 *
 * An empty slug never confirms, whatever was typed. A project cannot have one,
 * but a bug upstream could hand one here, and `'' === ''` would then delete on
 * an empty box — which is the failure mode a `startsWith` or an `includes`
 * would also have.
 */
export function confirmsDeletion(
  typed: string | null | undefined,
  slug: string,
): boolean {
  const wanted = slug.trim();
  if (!wanted) return false;

  return typed?.trim() === wanted;
}
