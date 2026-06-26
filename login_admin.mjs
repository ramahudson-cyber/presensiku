import { chromium } from "playwright";
import { execSync } from "child_process";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const browser = await chromium.launch({
  headless: false,
  channel: "chrome",
  args: ["--start-maximized"],
});

const page = await browser.newPage({ viewport: null });
await page.goto("https://siap-ampenan.vercel.app/", { waitUntil: "networkidle" });

await page.waitForTimeout(2000);

const usernameInput = page.locator('input[type="text"]');
await usernameInput.fill("admin");

const passwordInput = page.locator('input[type="password"]');
await passwordInput.fill("Puskesmas@123");

await page.locator('button[type="submit"]').click();
await page.waitForTimeout(5000);

await page.evaluate(() => {
  localStorage.setItem("theme", "light");
  document.documentElement.classList.remove("dark");
});

console.log("Login attempted. URL:", page.url());
