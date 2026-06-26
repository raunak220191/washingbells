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
    } else if (cmd === "login") {
      const [phone, password, out = "/tmp/wb-login.png"] = rest;
      if (!phone || !password) throw new Error("login needs <phone> <password>");
      await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 90000 });
      await waitForApp(page);
      await page.fill('input[placeholder="Enter mobile number"]', phone);
      await page.fill('input[placeholder="Password"]', password);
      log(`submitting login for ${phone}…`);
      // Button is a react-native-web TouchableOpacity rendering its title text.
      await page.getByText("Login with Password", { exact: false }).click();
      await page.waitForTimeout(4000); // let the API round-trip / navigation settle
      await shot(page, out);
      const body = (await page.innerText("body")).slice(0, 400);
      log("post-login body sample:", JSON.stringify(body));
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
