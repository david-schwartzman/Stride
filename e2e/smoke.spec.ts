// covers AC1, AC10, T13, T14
import { expect, test, type Page } from "@playwright/test";

test("every page renders the shared layout", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(page.locator("main#main")).toBeVisible();
  await expect(page.getByRole("contentinfo")).toBeVisible();
});

test("skip link is the first focusable element and jumps to #main", async ({
  page,
}) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();

  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main$/);
  await expect(page.locator("main#main")).toBeFocused();
});

for (const width of [375, 1280]) {
  test(`skip link lands #main below the sticky header at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    await skipPastHeader(page);
  });
}

async function skipPastHeader(page: Page) {
  await page.goto("/");
  // Make the page taller than the viewport so the jump actually scrolls.
  await page.evaluate(() => {
    const filler = document.createElement("div");
    filler.style.height = "3000px";
    document.getElementById("main")?.append(filler);
    window.scrollTo(0, 1500);
  });

  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main$/);

  const headerBottom = (await page.getByRole("banner").boundingBox())!;
  const mainTop = (await page.locator("main#main").boundingBox())!.y;
  expect(mainTop).toBeGreaterThanOrEqual(headerBottom.y + headerBottom.height);
}

test.describe("at 375px", () => {
  test.use({ viewport: { width: 375, height: 800 } });

  test("has no horizontal scroll and swaps the nav for the menu", async ({
    page,
  }) => {
    await page.goto("/");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBe(0);

    await expect(
      page.getByRole("navigation", { name: "Help and account" }),
    ).toBeHidden();
    await page.getByRole("button", { name: "Menu" }).click();
    const drawer = page.getByRole("dialog", { name: "Menu" });
    await expect(drawer.getByRole("link", { name: "Log in" })).toBeVisible();
  });
});
