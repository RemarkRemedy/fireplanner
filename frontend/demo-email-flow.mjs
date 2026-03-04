/**
 * Demo script: walks through the full email capture flow with screenshots.
 * Run: npx playwright test demo-email-flow.mjs --headed
 * Or:  node demo-email-flow.mjs
 */
import { chromium } from 'playwright';

const DELAY = 10_000; // 10 seconds between steps

async function main() {
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  // Mock the API endpoint
  await page.route('**/api/email-signup', async (route) => {
    await new Promise(r => setTimeout(r, 500));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });

  // Clear signup flag for a clean demo
  await page.goto('http://localhost:5173');
  await page.evaluate(() => {
    localStorage.removeItem('fireplanner-email-signed-up');
    sessionStorage.removeItem('fireplanner-email-capture-shown');
  });
  await page.reload();
  await page.waitForTimeout(1000);

  // ── STEP 1: Show the email input ──
  console.log('STEP 1: Email input form');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'demo-step1-email.png' });
  console.log('  Screenshot: demo-step1-email.png');
  console.log('  Waiting 10 seconds...');
  await page.waitForTimeout(DELAY);

  // ── STEP 2: Type email and submit ──
  console.log('STEP 2: Submitting email...');
  await page.getByRole('textbox', { name: 'Email address' }).fill('demo@sgfireplanner.com');
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Notify me' }).click();
  await page.waitForTimeout(2000); // wait for API mock + transition
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'demo-step2-feature.png' });
  console.log('  Screenshot: demo-step2-feature.png');
  console.log('  Waiting 10 seconds...');
  await page.waitForTimeout(DELAY);

  // ── STEP 3: Select a feature interest ──
  console.log('STEP 3: Selecting feature interest...');
  await page.getByRole('button', { name: 'CPF Optimization' }).click();
  await page.waitForTimeout(1000);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'demo-step3-done.png' });
  console.log('  Screenshot: demo-step3-done.png');
  console.log('  Waiting 10 seconds...');
  await page.waitForTimeout(DELAY);

  // ── STEP 4: Show privacy policy page ──
  console.log('STEP 4: Privacy policy page');
  await page.goto('http://localhost:5173/privacy');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'demo-step4-privacy.png', fullPage: true });
  console.log('  Screenshot: demo-step4-privacy.png');
  console.log('  Waiting 10 seconds...');
  await page.waitForTimeout(DELAY);

  // ── STEP 5: "Use a different email?" ──
  console.log('STEP 5: Back to start page - done state with "Use a different email?"');
  await page.goto('http://localhost:5173');
  await page.waitForTimeout(1000);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'demo-step5-already-signed.png' });
  console.log('  Screenshot: demo-step5-already-signed.png');
  console.log('  Waiting 10 seconds...');
  await page.waitForTimeout(DELAY);

  console.log('\nDone! All screenshots saved.');
  await browser.close();
}

main().catch(console.error);
