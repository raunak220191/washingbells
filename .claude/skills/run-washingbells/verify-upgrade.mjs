// One-off verifier for upgrade_last TASKs 1.4/2.2/3.1/4 on the web target.
// Screenshots: service baseline / search active / search cleared / address form.
import { chromium } from "playwright";

const BASE = process.env.WB_URL || "http://localhost:8081";
const log = (...a) => console.log("[verify]", ...a);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

// login
await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForFunction(() =>
  !!document.querySelector('input[placeholder="Enter mobile number"]'),
  null, { timeout: 60000, polling: 500 });
await page.fill('input[placeholder="Enter mobile number"]', "9000000001");
const toggle = page.getByText("Login with password instead", { exact: false });
if (await toggle.count()) await toggle.click();
await page.fill('input[placeholder="Password"]', "Test@1234");
await page.getByText("Login with Password", { exact: false }).click();
await page.waitForFunction(() => /Our Services/.test(document.body.innerText),
  null, { timeout: 20000, polling: 300 });
log("logged in");

// service screen (dry-clean has the seeded Blazer image)
await page.goto(`${BASE}/home/service/dry-clean`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => /Search items/.test(document.body.innerText) ||
  !!document.querySelector('input[placeholder="Search items"]'),
  null, { timeout: 30000, polling: 300 });
await page.waitForTimeout(1200); // images settle
await page.screenshot({ path: "/tmp/wb-svc-baseline.png" });
log("baseline shot");

// item order sample for the sort check
const names = await page.evaluate(() =>
  Array.from(document.querySelectorAll("div"))
    .map(d => d.textContent).join("\n"));
// search
await page.fill('input[placeholder="Search items"]', "sh");
await page.waitForTimeout(600); // debounce 250ms + render
await page.screenshot({ path: "/tmp/wb-svc-search.png" });
const searchText = await page.evaluate(() => document.body.innerText);
log("search results contain:", searchText.match(/[A-Za-z ]*[Ss]hirt[A-Za-z ]*/g)?.slice(0, 4));

// empty state
await page.fill('input[placeholder="Search items"]', "zzzz");
await page.waitForTimeout(600);
const emptyText = await page.evaluate(() => document.body.innerText);
log("empty state:", /No items found for/.test(emptyText) ? "OK" : "MISSING");
await page.screenshot({ path: "/tmp/wb-svc-empty.png" });

// clear -> restored
await page.fill('input[placeholder="Search items"]', "");
await page.waitForTimeout(600);
await page.screenshot({ path: "/tmp/wb-svc-restored.png" });
log("restored shot");

// address form (pin card + banner)
await page.goto(`${BASE}/home/address`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => /My Addresses|New Address/.test(document.body.innerText),
  null, { timeout: 30000, polling: 300 });
await page.waitForTimeout(800);
await page.screenshot({ path: "/tmp/wb-addr-list.png" });
const addrText = await page.evaluate(() => document.body.innerText);
log("pin banner on list:", /missing a map pin/.test(addrText) ? "SHOWN" : "not shown (all pinned)");
// open the add form
const addBtn = page.getByText("Add New Address", { exact: false });
if (await addBtn.count()) { await addBtn.first().click(); }
else {
  // FAB fallback: click the + FAB by accessibility or position
  const fab = page.locator('div[tabindex="0"]').last();
  await fab.click().catch(() => {});
}
await page.waitForTimeout(800);
await page.screenshot({ path: "/tmp/wb-addr-form.png" });
const formText = await page.evaluate(() => document.body.innerText);
log("pin section in form:", /Pin location on map|Location pinned/.test(formText) ? "OK" : "MISSING");

await browser.close();
log("done");
