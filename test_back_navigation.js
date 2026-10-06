import { chromium } from 'playwright';

async function testBackNavigation() {
  const b = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await b.newPage({ viewport: { width: 1280, height: 800 } });

  console.log('Navigating to photoshoots.html...');
  await page.goto('http://localhost:3000/photoshoots.html');

  console.log('Clicking BACK TO MOMENTS link...');
  await page.click('.header .button-small');

  await page.waitForURL('**/#work');
  console.log('URL is now:', page.url());

  // Check if loader appears again
  const loaderCount = await page.locator('#load-screen').count();
  console.log('Loader count after clicking back:', loaderCount);

  // Check scroll position immediately
  const scrollY1 = await page.evaluate(() => window.scrollY);
  console.log('Scroll Y immediately after back:', scrollY1);

  // Wait 13 seconds for loader to finish
  await page.waitForSelector('#load-screen', { state: 'detached', timeout: 15000 });
  const scrollY2 = await page.evaluate(() => window.scrollY);
  const workTop = await page.locator('#work').evaluate(el => el.getBoundingClientRect().top);
  console.log('Scroll Y after loader detached:', scrollY2, 'Work section bounding client top:', workTop);

  await b.close();
}

testBackNavigation().catch(console.error);

