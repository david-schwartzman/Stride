// covers AC3, AC6, AC9, AC11 (signup-login T13)
import { randomUUID } from "node:crypto";

import { expect, test, type BrowserContext, type Page } from "@playwright/test";

// Needs a migrated Postgres behind the app; CI provides one (signup-login T12).
test.skip(
  !process.env.TEST_DATABASE_URL,
  "needs TEST_DATABASE_URL (CI Postgres)",
);

const PASSWORD = "correct horse battery staple";

async function sessionCookie(context: BrowserContext) {
  return (await context.cookies()).find((c) =>
    c.name.endsWith("stride_session"),
  );
}

/** Signed-in shoppers get bounced off /login to / (AC9) — proof the session is live server-side. */
async function expectSignedIn(page: Page) {
  await page.goto("/login");
  await expect(page).toHaveURL("/");
}

test("sign up → session holds across reload; log in from a fresh browser → session holds", async ({
  page,
  context,
  browser,
}) => {
  const email = `e2e-${randomUUID()}@test.stride`;

  await page.goto("/signup");
  await page.getByLabel("Name").fill("Ada Lovelace");
  await page.getByLabel("Email").fill(`  ${email.toUpperCase()} `);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL("/");

  const cookie = await sessionCookie(context);
  expect(cookie).toMatchObject({ httpOnly: true, sameSite: "Lax", path: "/" });
  expect(cookie?.value).not.toContain(PASSWORD);

  await page.reload();
  await expectSignedIn(page);

  const fresh = await browser.newContext();
  const second = await fresh.newPage();
  await expect(sessionCookie(fresh)).resolves.toBeUndefined();

  await second.goto("/login");
  await second.getByLabel("Email").fill(email);
  await second.getByLabel("Password").fill(PASSWORD);
  await second.getByRole("button", { name: "Log in" }).click();
  await expect(second).toHaveURL("/");

  const secondCookie = await sessionCookie(fresh);
  expect(secondCookie?.value).toBeTruthy();
  expect(secondCookie?.value).not.toBe(cookie?.value);

  await second.reload();
  await expectSignedIn(second);
  await fresh.close();
});

test("a wrong password shows inline and sets no session cookie", async ({
  page,
  context,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(`nobody-${randomUUID()}@test.stride`);
  await page.getByLabel("Password").fill("not the right password");
  await page.getByRole("button", { name: "Log in" }).click();

  await expect(
    page.getByText("That password isn't right. Try again."),
  ).toBeVisible();
  await expect(page.getByLabel("Password")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(await sessionCookie(context)).toBeUndefined();
});

test("signing up with an existing email shows the inline error with a Log in link", async ({
  page,
  browser,
}) => {
  const email = `e2e-${randomUUID()}@test.stride`;
  const first = await browser.newContext();
  const firstPage = await first.newPage();
  await firstPage.goto("/signup");
  await firstPage.getByLabel("Name").fill("Ada Lovelace");
  await firstPage.getByLabel("Email").fill(email);
  await firstPage.getByLabel("Password").fill(PASSWORD);
  await firstPage.getByRole("button", { name: "Create account" }).click();
  await expect(firstPage).toHaveURL("/");
  await first.close();

  await page.goto("/signup");
  await page.getByLabel("Name").fill("Someone Else");
  await page.getByLabel("Email").fill(email.toUpperCase());
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByLabel("Email")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  const error = page.getByText("An account with this email already exists.");
  await expect(error).toBeVisible();
  await expect(error.getByRole("link", { name: "Log in" })).toHaveAttribute(
    "href",
    "/login",
  );
});
