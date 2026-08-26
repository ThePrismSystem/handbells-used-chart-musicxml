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
    // A native radio group shares one Tab stop — arrow keys move within it —
    // so counting each radio individually overstates how many Tab presses
    // it takes to reach every control.
    const seenRadioGroups = new Set<string>();
    return elements.filter((element) => {
      if (element instanceof HTMLInputElement && element.type === "radio") {
        if (seenRadioGroups.has(element.name)) {
          return false;
        }
        seenRadioGroups.add(element.name);
      }
      return true;
    }).length;
  });
  expect(reachable).toBeGreaterThan(0);

  const focused: string[] = [];
  for (let index = 0; index < reachable; index++) {
    await page.keyboard.press("Tab");
    focused.push(await page.evaluate(() => document.activeElement?.tagName ?? ""));
  }
  expect(focused.filter((tag) => tag !== "BODY").length).toBe(reachable);
});
