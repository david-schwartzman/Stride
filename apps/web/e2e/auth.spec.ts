// covers AC3, AC6, AC9, AC11 (signup-login T13); auth-api-migration AC5, AC6, AC14 (T7)
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

  // Set by the API through the /api rewrite. Outside production (the e2e API
  // runs with NODE_ENV=test) it's plain stride_session without Secure; the
  // __Host- name and Secure flag are unit-tested in auth.controller.test.ts.
  const cookie = await sessionCookie(context);
  expect(cookie).toMatchObject({
    name: "stride_session",
    httpOnly: true,
    secure: false,
    sameSite: "Lax",
    path: "/",
    // Host-only: a Domain attribute would show as ".localhost".
    domain: "localhost",
  });
  const DAY_S = 24 * 60 * 60;
  expect(cookie!.expires - Date.now() / 1000).toBeGreaterThan(29 * DAY_S);
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

test("logout is a plain form POST to /api/auth/logout: 303 to /, cookie cleared, session gone", async ({
  page,
  context,
}) => {
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Ada Lovelace");
  await page.getByLabel("Email").fill(`e2e-${randomUUID()}@test.stride`);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL("/");
  const token = (await sessionCookie(context))?.value;
  expect(token).toBeTruthy();

  // A native form submission, as a no-JavaScript logout button would send.
  const logout = page.waitForResponse((r) =>
    r.url().endsWith("/api/auth/logout"),
  );
  await page.evaluate(() => {
    const form = document.createElement("form");
    form.method = "post";
    form.action = "/api/auth/logout";
    document.body.append(form);
    form.submit();
  });
  const res = await logout;
  expect(res.status()).toBe(303);
  expect(res.headers()["location"]).toBe("/");
  await expect(page).toHaveURL("/");
  expect(await sessionCookie(context)).toBeUndefined();

  // The old token is dead server-side, not just forgotten by the browser.
  await context.addCookies([
    { name: "stride_session", value: token!, url: page.url() },
  ]);
  await page.goto("/login");
  await expect(page).toHaveURL("/login");
});
