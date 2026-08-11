import { expect, test } from '@playwright/test';

/**
 * The conversion flow.
 *
 * Three things are worth pinning here, and only one of them is visible on the
 * live site today:
 *
 *  1. The gate sits after the evidence, not before it. A visitor should
 *     understand the product and see the real pull request before anything asks
 *     them for something.
 *  2. It collects nothing. There is no auth backend (CLAUDE.md), so a sign-up
 *     form here would be the simulation this project forbids — and it would
 *     cost the reader their email address to discover that.
 *  3. Someone who already has access is never interrupted. That branch is
 *     unreachable today and is the most expensive one to get wrong, so it is
 *     asserted at the source rather than through the UI.
 */

test('the gate sits after the evidence, not at the top of the page', async ({
  page,
}) => {
  await page.goto('/');
  const cta = page.getByRole('button', { name: 'Run it on your repository' });
  await expect(cta).toBeVisible();

  const position = await cta.evaluate(
    (el) =>
      (el.getBoundingClientRect().top + window.scrollY) /
      document.body.scrollHeight,
  );
  // Comfortably past the fold: the pull request, the pipeline and the status
  // board all come first.
  expect(position).toBeGreaterThan(0.6);
});

test('the dialog asks for nothing it cannot honour', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Run it on your repository' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // No credential capture of any kind while there is nothing to sign in to.
  await expect(
    dialog.locator('input[type="email"], input[type="password"], form'),
  ).toHaveCount(0);

  // It says so, in the same words the landing page's status board uses.
  await expect(
    dialog.getByText(/hosted accounts are not built yet/i),
  ).toBeVisible();

  // And it hands over the two things that genuinely work.
  await expect(
    dialog.getByRole('link', { name: /see the pull request/i }),
  ).toBeVisible();
  await expect(
    dialog.getByRole('link', { name: /follow on github/i }),
  ).toBeVisible();
});

test('the dialog quotes no price, because none is modelled', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Run it on your repository' }).click();

  const text = (await page.getByRole('dialog').textContent()) ?? '';
  // A currency figure here would be the first false claim on the site.
  expect(text).not.toMatch(/[$£€]\s?\d/);
  expect(text).not.toMatch(/\bper (word|character|key|seat)\b/i);
});

test('the dialog is dismissible and restores focus', async ({ page }) => {
  await page.goto('/');
  const cta = page.getByRole('button', { name: 'Run it on your repository' });
  await cta.click();
  await expect(page.getByRole('dialog')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  // Focus must come back to the control that opened it, or a keyboard user is
  // dropped at the top of the document.
  await expect(cta).toBeFocused();
});
