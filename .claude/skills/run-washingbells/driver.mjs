#!/usr/bin/env node
// Playwright driver for the WashingBells customer app running on Expo Web.
//
// The app is a React Native (Expo SDK 54) app. `expo start --web` serves it
// via react-native-web at http://localhost:8081. This driver opens that URL in
// a mobile-sized chromium, waits for the RN app to hydrate, drives it, and
// writes screenshots to /tmp.
//
// Usage:
//   node driver.mjs shot [outPath]                  open app, wait for login, screenshot
//   node driver.mjs goto <route> [outPath]          navigate to an expo-router route (e.g. /(authenticate)/login)
//   node driver.mjs login <phone> <password> [out]  fill + submit password login, screenshot result
//
// Env:
//   WB_URL   base URL (default http://localhost:8081)
//   WB_HEADED=1  run headed (default headless)
//
// Self-contained: playwright is installed in this skill dir's node_modules and
// chromium comes from the shared ~/Library/Caches/ms-playwright cache.

import { chromium } from "playwright";

const BASE = process.env.WB_URL || "http://localhost:8081";
const HEADED = process.env.WB_HEADED === "1";
const [, , cmd = "shot", ...rest] = process.argv;

// react-native-web renders the RN tree into a #root div. We consider the app
// "ready" once the login screen's brand text or the phone input is present.
const LOGIN_MARKERS = ["WASHING", "Enter mobile number", "Welcome!"];

function log(...a) { console.log("[driver]", ...a); }

async function waitForApp(page, timeout = 60000) {
  // First web bundle is compiled on demand by Metro and can take 30-60s.
  log("waiting for app to hydrate (first bundle can take ~30-60s)…");
  await page.waitForFunction(
    (markers) => {
      const t = document.body?.innerText || "";
      return markers.some((m) => t.includes(m)) ||
             !!document.querySelector('input[placeholder="Enter mobile number"]');
    },
    LOGIN_MARKERS,
    { timeout, polling: 500 }
  );
  log("app hydrated.");
}

async function shot(page, out) {
  await page.screenshot({ path: out, fullPage: false });
  log("screenshot ->", out);
}

async function doLogin(page, phone, password) {
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 90000 });
  await waitForApp(page);
  await page.fill('input[placeholder="Enter mobile number"]', phone);
  // The login screen defaults to OTP mode; the password field is behind the
  // "Login with password instead" toggle.
  const toggle = page.getByText("Login with password instead", { exact: false });
  if (await toggle.count()) await toggle.click();
  await page.fill('input[placeholder="Password"]', password);
  log(`submitting login for ${phone}…`);
  await page.getByText("Login with Password", { exact: false }).click();
  // Wait for the Home screen to appear (greeting text) rather than a fixed sleep.
  await page.waitForFunction(
    () => (document.body?.innerText || "").includes("Good Morning") ||
          (document.body?.innerText || "").includes("Good Afternoon") ||
          (document.body?.innerText || "").includes("Good Evening") ||
          (document.body?.innerText || "").includes("Our Services"),
    null, { timeout: 20000, polling: 300 }
  );
  log("reached Home.");
}

function onHome(text) {
  return /Good (Morning|Afternoon|Evening)|Our Services/.test(text);
}

async function main() {
  const browser = await chromium.launch({ headless: !HEADED });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, // iPhone 12/13/14 logical size
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
  });
  const page = await context.newPage();
  page.on("console", (m) => {
    if (m.type() === "error") log("page-error:", m.text());
  });

  let exitCode = 0;
  try {
    if (cmd === "shot") {
      const out = rest[0] || "/tmp/wb-shot.png";
      await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 90000 });
      await waitForApp(page);
      await shot(page, out);
    } else if (cmd === "goto") {
      const route = rest[0];
      const out = rest[1] || "/tmp/wb-goto.png";
      if (!route) throw new Error("goto needs a <route>");
      await page.goto(BASE + "/" + route.replace(/^\//, ""), { waitUntil: "domcontentloaded", timeout: 90000 });
      await waitForApp(page).catch(() => log("login markers not found (route may differ); screenshotting anyway"));
      await page.waitForTimeout(1500);
      await shot(page, out);
    } else if (cmd === "authshot") {
      // Log in, then navigate to a route in the SAME context (goto alone runs
      // logged-out) and screenshot it. Usage: authshot <phone> <pass> <route> <out>
      // Optional 5th arg: semicolon-separated actions, e.g.
      //   "click:WashingBells Express;scroll:1200;click:Tomorrow"
      const [phone, password, route, out = "/tmp/wb-authshot.png", actionsArg = ""] = rest;
      if (!phone || !password || !route) throw new Error("authshot needs <phone> <password> <route>");
      await doLogin(page, phone, password);
      await page.goto(BASE + "/" + route.replace(/^\//, ""), { waitUntil: "domcontentloaded", timeout: 90000 });
      await page.waitForTimeout(4000);
      for (const action of actionsArg.split(";").filter(Boolean)) {
        const [verb, ...valParts] = action.split(":");
        const val = valParts.join(":");
        if (verb === "click") {
          await page.getByText(val, { exact: false }).first().click({ timeout: 10000 });
          await page.waitForTimeout(2500);
          log(`clicked ${JSON.stringify(val)}`);
        } else if (verb === "scroll") {
          await page.mouse.wheel(0, parseInt(val, 10) || 800);
          await page.waitForTimeout(1200);
          log(`scrolled ${val}px`);
        }
      }
      await shot(page, out);
      const text = await page.innerText("body");
      log("body sample:", JSON.stringify(text.slice(0, 250)));
    } else if (cmd === "login") {
      const [phone, password, out = "/tmp/wb-login.png"] = rest;
      if (!phone || !password) throw new Error("login needs <phone> <password>");
      try {
        await doLogin(page, phone, password);
      } catch {
        log("did not reach Home (backend down or bad creds?)");
      }
      await shot(page, out);
      const body = (await page.innerText("body")).slice(0, 400);
      log("post-login body sample:", JSON.stringify(body));
    } else if (cmd === "persist") {
      // Verify persistent login: log in, then reload the SAME browser context
      // (localStorage retained) and confirm we land on Home without re-login.
      const [phone, password, out = "/tmp/wb-persist.png"] = rest;
      if (!phone || !password) throw new Error("persist needs <phone> <password>");
      await doLogin(page, phone, password);
      const hasRefresh = await page.evaluate(() => !!localStorage.getItem("refresh_token"));
      log("refresh_token stored after login:", hasRefresh);
      log("reloading page to test silent session restore…");
      await page.reload({ waitUntil: "domcontentloaded", timeout: 90000 });
      await page.waitForTimeout(5000);
      const text = await page.innerText("body");
      await shot(page, out);
      if (onHome(text)) log("PASS: session restored to Home after reload");
      else { log("FAIL: not on Home after reload. Body:", JSON.stringify(text.slice(0, 200))); exitCode = 1; }
    } else if (cmd === "refresh-restore") {
      // Verify refresh-token cold start: log in, drop the access token (keep the
      // refresh token), reload → initialize() should mint a new access token.
      const [phone, password, out = "/tmp/wb-refresh.png"] = rest;
      if (!phone || !password) throw new Error("refresh-restore needs <phone> <password>");
      await doLogin(page, phone, password);
      await page.evaluate(() => localStorage.removeItem("auth_token"));
      log("removed auth_token, kept refresh_token; reloading…");
      await page.reload({ waitUntil: "domcontentloaded", timeout: 90000 });
      await page.waitForTimeout(6000);
      const text = await page.innerText("body");
      const newAccess = await page.evaluate(() => !!localStorage.getItem("auth_token"));
      await shot(page, out);
      log("auth_token re-minted via refresh:", newAccess);
      if (onHome(text) && newAccess) log("PASS: refresh-token cold start restored session");
      else { log("FAIL: refresh restore did not reach Home. Body:", JSON.stringify(text.slice(0, 200))); exitCode = 1; }
    } else if (cmd === "tour") {
      // Log in, then visit each bottom tab and screenshot. Flags Expo redboxes.
      const [phone, password, outDir = "/tmp/wb-tour"] = rest;
      if (!phone || !password) throw new Error("tour needs <phone> <password>");
      await doLogin(page, phone, password);
      // Session is in localStorage now; navigate by URL within the same context
      // (expo-router strips the (tabs) group, so /basket, /orders, /profile).
      const routes = ["home", "basket", "orders", "profile", "profile/wallet", "profile/edit"];
      for (const route of routes) {
        await page.goto(`${BASE}/${route}`, { waitUntil: "domcontentloaded", timeout: 90000 });
        await page.waitForTimeout(4000);
        const out = `${outDir}-${route.replace("/", "-")}.png`;
        await shot(page, out);
        const text = await page.innerText("body");
        const redbox = /Uncaught Error|Console Error|Render Error|TypeError|undefined is not|is not a function/.test(text);
        log(`route /${route}: ${redbox ? "‼ ERROR OVERLAY" : "ok"} :: ${JSON.stringify(text.slice(0, 110))}`);
      }
    } else {
      throw new Error(`unknown command: ${cmd}`);
    }
  } catch (e) {
    exitCode = 1;
    log("ERROR:", e.message);
    await page.screenshot({ path: "/tmp/wb-error.png" }).catch(() => {});
    log("error screenshot -> /tmp/wb-error.png");
  } finally {
    await browser.close();
  }
  process.exit(exitCode);
}

main();
