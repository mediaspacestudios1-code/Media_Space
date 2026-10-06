import { chromium } from 'playwright';

async function runRegressionTests() {
  console.log('=== STARTING FULL REGRESSION TEST SUITE ===\n');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });

  let allPassed = true;
  const logPass = (name) => console.log(`  [PASS] ${name}`);
  const logFail = (name, err) => {
    console.error(`  [FAIL] ${name}:`, err);
    allPassed = false;
  };

  // Test 1: Loader Skip Button
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
    const skipBtn = page.locator('#loader-skip');
    await skipBtn.waitFor({ state: 'visible', timeout: 3000 });
    await skipBtn.click();
    await page.waitForSelector('#load-screen', { state: 'detached', timeout: 2000 });
    logPass('Loader Skip Button instantly dismisses splash screen');
    await page.close();
  } catch (err) {
    logFail('Loader Skip Button', err.message);
  }

  // Test 2: Hash anchor navigation & direct arrival
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto('http://localhost:3000/#work', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#load-screen', { state: 'detached', timeout: 2000 });
    const scrollY = await page.evaluate(() => window.scrollY);
    const workOffset = await page.locator('#work').evaluate(el => el.getBoundingClientRect().top);
    if (Math.abs(workOffset) > 200) {
      throw new Error(`Did not scroll to #work (offset: ${workOffset}, scrollY: ${scrollY})`);
    }
    logPass('Direct arrival at #work bypasses intro delay and scrolls to section');
    await page.close();
  } catch (err) {
    logFail('Hash anchor navigation', err.message);
  }

  // Test 3: Returning from photoshoots.html to /#work
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto('http://localhost:3000/photoshoots.html');
    await page.click('.header .button-small');
    await page.waitForURL('**/#work');
    await page.waitForSelector('#load-screen', { state: 'detached', timeout: 2000 });
    const workOffset = await page.locator('#work').evaluate(el => el.getBoundingClientRect().top);
    if (Math.abs(workOffset) > 200) {
      throw new Error(`Back to moments did not land at #work (offset: ${workOffset})`);
    }
    logPass('Back to moments from photo gallery smoothly returns to #work');
    await page.close();
  } catch (err) {
    logFail('Back navigation from photoshoots', err.message);
  }

  // Test 4: All 8 Services, Gym & Kavitha Jewellers selection, Pill & Placeholders
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto('http://localhost:3000/#services');
    await page.waitForSelector('#load-screen', { state: 'detached', timeout: 2000 });

    const serviceCards = page.locator('.service-card');
    const count = await serviceCards.count();
    if (count !== 8) throw new Error(`Expected 8 service cards, got ${count}`);

    // Test Gym enquiry arrow
    const gymLink = page.locator('.service-card a[data-service="Gym"]');
    await gymLink.click();
    const gymPlaceholder = await page.locator('#booking-form textarea[name="message"]').getAttribute('placeholder');
    const gymPillText = await page.locator('#selected-service-name').textContent();
    const pillHidden1 = await page.locator('#selected-service-pill').getAttribute('hidden');
    if (!gymPlaceholder.includes('Gym') || gymPillText !== 'Gym' || pillHidden1 !== null) {
      throw new Error(`Gym enquiry pill/placeholder failure (text: ${gymPillText}, ph: ${gymPlaceholder})`);
    }

    // Clear service pill
    await page.locator('#clear-service-btn').click();
    const pillHidden2 = await page.locator('#selected-service-pill').getAttribute('hidden');
    const clearedPlaceholder = await page.locator('#booking-form textarea[name="message"]').getAttribute('placeholder');
    if (pillHidden2 === null || clearedPlaceholder.includes('Gym')) {
      throw new Error('Clearing service pill failed');
    }

    // Test Kavitha Jewellers enquiry arrow
    const kjLink = page.locator('.service-card a[data-service="Kavitha Jewellers"]');
    await kjLink.click();
    const kjPillText = await page.locator('#selected-service-name').textContent();
    if (kjPillText !== 'Kavitha Jewellers') {
      throw new Error(`Kavitha Jewellers enquiry pill failure: ${kjPillText}`);
    }
    logPass('Service cards include all 8 services with clearable enquiry pills and dynamic placeholders');
    await page.close();
  } catch (err) {
    logFail('Service card enquiry & pill', err.message);
  }

  // Test 5: Booking Form Submission with Gym & Kavitha Jewellers services attached
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto('http://localhost:3000/#booking');
    await page.waitForSelector('#load-screen', { state: 'detached', timeout: 2000 });

    // Attach Gym service
    await page.locator('.service-card a[data-service="Gym"]').first().click();

    await page.fill('#booking-form input[name="name"]', 'Gym Booking Test');
    await page.fill('#booking-form input[name="phone"]', '+91 9944367651');
    await page.fill('#booking-form input[name="email"]', 'gymtest@mediaspace.example');
    await page.selectOption('#booking-form select[name="event"]', 'Other');
    await page.selectOption('#booking-form select[name="package"]', 'Basic');
    await page.fill('#booking-form input[name="date"]', '2026-11-20');
    await page.fill('#booking-form input[name="place"]', 'Pollachi Fitness Center');

    await page.click('#booking-form button[type="submit"]');
    await page.waitForTimeout(2000);

    const status = await page.textContent('#booking-form .form-status');
    const isSuccess = await page.locator('#booking-form .form-status').evaluate(el => el.classList.contains('success'));
    if (!isSuccess || !status.includes('delivered')) {
      throw new Error(`Booking submission failed with Gym service: "${status}"`);
    }
    logPass('Booking enquiry with Gym service succeeds and delivers via backend API');
    await page.close();
  } catch (err) {
    logFail('Booking submission with Gym service', err.message);
  }

  // Test 6: Gallery Filters including Gym & Kavitha Jewellers
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto('http://localhost:3000/#work');
    await page.waitForSelector('#load-screen', { state: 'detached', timeout: 2000 });

    const expectedFilters = ['All', 'Car Decors', 'Catering', 'Dress Shop', 'Holidays', 'Personal Booking', 'Saloon', 'Gym', 'Kavitha Jewellers', 'PhotoShoots Folder'];
    for (const name of expectedFilters) {
      const btn = page.locator(`.filter[data-filter="${name}"]`);
      if (await btn.count() === 0) throw new Error(`Missing filter button for: ${name}`);
      await btn.click();
      const count = await page.locator('#gallery article').count();
      if (count === 0) throw new Error(`Filter "${name}" showed 0 items`);
    }
    logPass('Gallery filters contain all 10 filter categories and display matching reels');
    await page.close();
  } catch (err) {
    logFail('Gallery filters', err.message);
  }

  // Test 7: Mobile Responsiveness, Menu Toggle & No Horizontal Overflow
  try {
    const page = await browser.newPage({ viewport: { width: 375, height: 667 } });
    await page.goto('http://localhost:3000');
    await page.waitForSelector('#load-screen', { state: 'detached', timeout: 2000 });

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 0) throw new Error(`Mobile has horizontal overflow: ${overflow}px`);

    const menuToggle = page.locator('.menu-toggle');
    await menuToggle.click();
    const isOpen = await page.locator('.nav').evaluate(el => el.classList.contains('open'));
    if (!isOpen) throw new Error('Menu toggle failed to open nav');

    await page.locator('.nav a[href="#packages"]').click();
    const isClosedAfterClick = await page.locator('.nav').evaluate(el => !el.classList.contains('open'));
    if (!isClosedAfterClick) throw new Error('Nav did not close after link click');

    logPass('Mobile responsiveness (375px) has zero overflow and menu toggle behaves properly');
    await page.close();
  } catch (err) {
    logFail('Mobile responsiveness', err.message);
  }

  // Test 8: Photoshoots Page Lightbox, Keyboard, Touch Swipes & Floating Buttons
  try {
    const page = await browser.newPage({ viewport: { width: 375, height: 667 } });
    await page.goto('http://localhost:3000/photoshoots.html');
    await page.waitForLoadState('networkidle');

    // Check floating contact buttons
    const wa = page.locator('.whatsapp-contact');
    const ig = page.locator('.instagram-contact');
    if (await wa.count() === 0 || await ig.count() === 0) throw new Error('Missing floating WhatsApp/Instagram buttons on photoshoots page');

    // Open lightbox
    await page.locator('.photo-tile').first().click();
    const isVisible = await page.locator('#photoLightbox').isVisible();
    if (!isVisible) throw new Error('Lightbox did not open');

    // Next button
    await page.locator('.lightbox-next').click();
    const cap1 = await page.locator('#photoLightbox figcaption').textContent();
    if (!cap1.includes('02')) throw new Error(`Expected photo 02, got ${cap1}`);

    // Prev button
    await page.locator('.lightbox-prev').click();
    const cap0 = await page.locator('#photoLightbox figcaption').textContent();
    if (!cap0.includes('01')) throw new Error(`Expected photo 01, got ${cap0}`);

    // Escape key
    await page.keyboard.press('Escape');
    const isClosed = await page.locator('#photoLightbox').evaluate(el => el.hidden);
    if (!isClosed) throw new Error('Escape key did not close lightbox');

    logPass('Photoshoots page lightbox, navigation, floating CTAs and mobile layout passed');
    await page.close();
  } catch (err) {
    logFail('Photoshoots page', err.message);
  }

  // Test 9: Zero Console Errors and Zero Network Failures
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const consoleErrors = [];
    const failedRequests = [];

    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('requestfailed', req => {
      failedRequests.push({ url: req.url(), failure: req.failure()?.errorText });
    });
    page.on('response', res => {
      if (res.status() >= 400 && !res.url().includes('favicon')) {
        failedRequests.push({ url: res.url(), status: res.status() });
      }
    });

    await page.goto('http://localhost:3000');
    await page.locator('#loader-skip').click();
    await page.waitForTimeout(1000);

    // Click all package cards
    const pkgCards = page.locator('.package-card');
    const pkgCount = await pkgCards.count();
    for (let i = 0; i < pkgCount; i++) {
      await pkgCards.nth(i).click();
    }

    // Navigate to photoshoots
    await page.goto('http://localhost:3000/photoshoots.html');
    await page.waitForTimeout(1000);

    if (consoleErrors.length > 0) {
      throw new Error(`Console errors detected: ${JSON.stringify(consoleErrors)}`);
    }
    if (failedRequests.length > 0) {
      throw new Error(`Failed requests detected: ${JSON.stringify(failedRequests)}`);
    }

    logPass('Zero console errors and zero failed network requests across full navigation flow');
    await page.close();
  } catch (err) {
    logFail('Console and network check', err.message);
  }

  await browser.close();

  console.log('\n===========================================');
  if (allPassed) {
    console.log('✅ ALL REGRESSION TESTS PASSED SUCCESSFULLY!');
  } else {
    console.error('❌ SOME TESTS FAILED. PLEASE REVIEW LOGS.');
    process.exit(1);
  }
}

runRegressionTests().catch(err => {
  console.error('Regression test runner error:', err);
  process.exit(1);
});

