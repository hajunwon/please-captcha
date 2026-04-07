import "dotenv/config";
import puppeteer from "puppeteer";
import { solveCaptcha } from "../src/index";

async function main() {
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--window-size=1920,1080",
    ],
    defaultViewport: { width: 1920, height: 1080 },
  });

  const page = await browser.newPage();

  // Navigate to hCaptcha demo page
  await page.goto("https://accounts.hcaptcha.com/demo", {
    waitUntil: "networkidle2",
  });

  console.log("Page loaded. Attempting to solve captcha...");

  const success = await solveCaptcha(page, {
    provider: "claude-code", // "claude-code" (no API key!) | "gemini" | "claude"
    verbose: true,
    maxRetries: 5,
  });

  if (success) {
    console.log("✓ Captcha solved successfully!");
  } else {
    console.log("✗ Failed to solve captcha");
  }

  // Keep browser open for inspection
  await new Promise((resolve) => setTimeout(resolve, 10_000));
  await browser.close();
}

main().catch(console.error);
