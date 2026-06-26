import { chromium } from "playwright";

const browser = await chromium.launch({
  headless: false,
  channel: "chrome",
  args: ["--start-maximized"],
});

const page = await browser.newPage({ viewport: null });
await page.goto("http://localhost:5174/", { waitUntil: "networkidle", timeout: 15000 });

await page.fill('input[type="text"]', "admin");
await page.fill('input[type="password"]', "Puskesmas@123");
await page.click('button[type="submit"]');

await page.waitForURL("**/admin", { timeout: 10000 });
await page.evaluate(() => { localStorage.setItem("theme", "light"); location.reload(); });

console.log("Login sukses, mode light aktif");
