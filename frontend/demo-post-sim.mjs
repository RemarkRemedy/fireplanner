/**
 * Demo: Post-simulation email capture after running Monte Carlo.
 * Run: node demo-post-sim.mjs
 */
import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: false, slowMo: 50 });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  // Mock the email API endpoint
  await page.route('**/api/email-signup', async (route) => {
    await new Promise(r => setTimeout(r, 300));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });

  // Clear signup flags for clean demo
  await page.goto('http://localhost:5173');
  await page.evaluate(() => {
    localStorage.removeItem('fireplanner-email-signed-up');
    sessionStorage.removeItem('fireplanner-email-capture-shown');
    sessionStorage.removeItem('fireplanner-post-sim-dismissed');
  });

  // Navigate to Stress Test page
  console.log('Navigating to Stress Test page...');
  await page.goto('http://localhost:5173/stress-test');
  await page.waitForTimeout(1000);

  // Click "Run Monte Carlo" button
  console.log('Running Monte Carlo simulation...');
  const runButton = page.getByRole('button', { name: /run simulation/i });

  // Check if the button exists and is enabled
  const buttonCount = await runButton.count();
  if (buttonCount === 0) {
    console.log('Run button not found. Taking screenshot of current state...');
    await page.screenshot({ path: 'demo-post-sim-state.png' });
    await browser.close();
    return;
  }

  await runButton.click();

  // Wait for simulation to complete — look for the "Run Simulation" button to reappear (not "Running...")
  console.log('Waiting for simulation to complete...');
  try {
    await page.waitForFunction(() => {
      const btns = [...document.querySelectorAll('button')];
      return btns.some(b => b.textContent?.includes('Run Simulation') && !b.disabled);
    }, { timeout: 60000 });
  } catch {
    console.log('Timeout waiting for completion, continuing...');
  }
  await page.waitForTimeout(3000);

  // Scroll down gradually to find the post-simulation email capture (it's after charts)
  console.log('Scrolling to post-simulation email capture...');

  // First, scroll to bottom to trigger any lazy rendering
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(2000);

  // Take a full-page screenshot to see everything
  await page.screenshot({ path: 'demo-post-sim-full.png', fullPage: true });
  console.log('Full-page screenshot saved: demo-post-sim-full.png');

  // Now try to find and scroll to the email capture card
  const emailCard = page.locator('text=/stay updated|feature launches|notify me/i').first();
  const cardExists = await emailCard.count();
  if (cardExists > 0) {
    await emailCard.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'demo-post-sim-capture.png' });
    console.log('Email capture screenshot saved: demo-post-sim-capture.png');
  } else {
    console.log('Email capture card not found on page. Check full-page screenshot.');
  }

  // Wait so user can see it
  console.log('Waiting 10 seconds...');
  await page.waitForTimeout(10000);

  console.log('Done!');
  await browser.close();
}

main().catch(console.error);
