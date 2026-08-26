import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const scan = async (page: import("@playwright/test").Page) =>
  new AxeBuilder({ page }).withTags(TAGS).analyze();

const load = async (page: import("@playwright/test").Page) => {
  await page.goto("/");
  await page
    .getByLabel(/choose a musicxml file/i)
    .setInputFiles("test/fixtures/piano-handbells.musicxml");
  await expect(page.getByRole("heading", { name: /handbells used/i })).toBeVisible();
};

test("the empty state passes in light mode", async ({ page }) => {
  await page.goto("/");
  expect((await scan(page)).violations).toEqual([]);
});

test("the review panel passes in light mode", async ({ page }) => {
  await load(page);
  // This is the check jsdom cannot make: real layout, real computed styles,
  // and therefore real colour contrast.
  expect((await scan(page)).violations).toEqual([]);
});

test.describe("dark mode", () => {
  test.use({ colorScheme: "dark" });

  test("the review panel passes in dark mode", async ({ page }) => {
    await load(page);
    expect((await scan(page)).violations).toEqual([]);
  });
});

test("every control is reachable by keyboard", async ({ page }) => {
  await load(page);
  const reachable = await page.evaluate(() => {
    const selector = "a[href], button, input, select, textarea, [tabindex]:not([tabindex='-1'])";
    const elements = [...document.querySelectorAll(selector)].filter(
      (element) => !element.hasAttribute("disabled") && element.getAttribute("tabindex") !== "-1",
    );
    // Stamp each control with the Tab stop it belongs to, so focus can be
    // identified afterwards by stop rather than by tag — several controls here
    // share a tag, and tags cannot tell two of them apart.
    //
    // A native radio group is ONE stop: arrow keys move within it, and the
    // member that receives focus is whichever is checked. So every radio in a
    // group gets the same stop id, and the assertion holds whichever member
    // the browser lands on.
    const stopIds = new Map<string, string>();
    for (const element of elements) {
      const key =
        element instanceof HTMLInputElement && element.type === "radio"
          ? `radio:${element.name}`
          : `control:${String(stopIds.size)}`;
      const id = stopIds.get(key) ?? String(stopIds.size);
      stopIds.set(key, id);
      element.setAttribute("data-a11y-stop", id);
    }
    return stopIds.size;
  });
  expect(reachable).toBeGreaterThan(0);

  const focused: (string | null)[] = [];
  for (let index = 0; index < reachable; index++) {
    await page.keyboard.press("Tab");
    focused.push(
      await page.evaluate(() => document.activeElement?.getAttribute("data-a11y-stop") ?? null),
    );
  }

  // Every press must land on a stamped control...
  expect(focused.every((id) => id !== null)).toBe(true);
  // ...and on a DIFFERENT one each time. Without this, focus pinned to a single
  // input would satisfy the test completely while reaching nothing else.
  expect(new Set(focused).size).toBe(reachable);
});
