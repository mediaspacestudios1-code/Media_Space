import { chromium } from 'playwright';

async function launchBrowser() {
  try {
    return await chromium.launch({ channel: 'msedge', headless: true });
  } catch {
    try {
      return await chromium.launch({ channel: 'chrome', headless: true });
    } catch {
      return await chromium.launch({ headless: true });
    }
  }
}

async function runTestSuite() {
  const browser = await launchBrowser();
  const report = {
    consoleErrors: [],
    consoleWarnings: [],
    failedRequests: [],
    brokenLinks: [],
    issues: [],
    results: []
  };

  const viewports = [
    { name: 'Desktop', width: 1280, height: 800 },
    { name: 'Tablet', width: 768, height: 1024 },
    { name: 'Mobile', width: 375, height: 667 }
  ];

  for (const vp of viewports) {
    console.log(`\n=== Testing Viewport: ${vp.name} (${vp.width}x${vp.height}) ===`);
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();

    page.on('pageerror', error => {
      report.consoleErrors.push({ viewport: vp.name, type: 'pageerror', text: error.message, stack: error.stack });
    });

    page.on('console', msg => {
      if (msg.type() === 'error') {
        report.consoleErrors.push({ viewport: vp.name, text: msg.text(), location: msg.location() });
      } else if (msg.type() === 'warning') {
        report.consoleWarnings.push({ viewport: vp.name, text: msg.text() });
      }
    });

    page.on('requestfailed', req => {
      report.failedRequests.push({ viewport: vp.name, url: req.url(), failure: req.failure()?.errorText });
    });

    page.on('response', res => {
      if (res.status() >= 400) {
        report.failedRequests.push({ viewport: vp.name, url: res.url(), status: res.status() });
      }
    });

    // 1. Test Home Page
    console.log(`[${vp.name}] Loading http://localhost:3000/ ...`);
    const resp = await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
    if (!resp || resp.status() !== 200) {
      report.issues.push(`Home page returned status ${resp ? resp.status() : 'NO_RESPONSE'}`);
    }

    // Check loader screen
    const loader = page.locator('#load-screen');
    const loaderCount = await loader.count();
    console.log(`[${vp.name}] Loader screen count: ${loaderCount}`);
    // Wait for loader or finishLoading
    try {
      await page.waitForSelector('#load-screen', { state: 'detached', timeout: 13000 });
      console.log(`[${vp.name}] Loader screen finished and detached.`);
    } catch {
      console.log(`[${vp.name}] Loader screen did not detach within 13s!`);
      report.issues.push(`[${vp.name}] Loader screen did not detach automatically.`);
    }

    // Test Navigation links
    const navLinks = page.locator('.nav a, .hero-actions a, .brand, .footer a');
    const navLinkCount = await navLinks.count();
    console.log(`[${vp.name}] Found ${navLinkCount} navigation & footer links`);

    // Test Mobile Menu Toggle (if visible)
    const menuToggle = page.locator('.menu-toggle');
    if (await menuToggle.isVisible()) {
      console.log(`[${vp.name}] Testing menu toggle...`);
      const expandedBefore = await menuToggle.getAttribute('aria-expanded');
      await menuToggle.click();
      const expandedAfter = await menuToggle.getAttribute('aria-expanded');
      const navOpen = await page.locator('.nav').evaluate(el => el.classList.contains('open'));
      console.log(`[${vp.name}] Menu toggle: before=${expandedBefore}, after=${expandedAfter}, nav.open=${navOpen}`);
      if (expandedAfter !== 'true' || !navOpen) {
        report.issues.push(`[${vp.name}] Menu toggle failed to expand navigation.`);
      }

      // Click a nav link inside menu and verify menu closes
      const firstNavLink = page.locator('.nav a[href="#about"]');
      await firstNavLink.click();
      const navOpenAfterClick = await page.locator('.nav').evaluate(el => el.classList.contains('open'));
      if (navOpenAfterClick) {
        report.issues.push(`[${vp.name}] Mobile navigation did not close when nav link was clicked.`);
      }
    }

    // Test Service Grid
    const serviceCards = page.locator('.service-card');
    const serviceCount = await serviceCards.count();
    console.log(`[${vp.name}] Service cards found: ${serviceCount}`);
    if (serviceCount === 0) {
      report.issues.push(`[${vp.name}] No service cards rendered in #service-grid.`);
    }

    // Test clicking a service link (e.g. Car Decors or Saloon)
    const saloonLink = page.locator('.service-card a[data-service="Saloon"]');
    if (await saloonLink.count() > 0) {
      await saloonLink.click();
      const selectedService = await page.locator('#booking-form').evaluate(el => el.dataset.selectedService);
      const placeholder = await page.locator('#booking-form textarea[name="message"]').getAttribute('placeholder');
      console.log(`[${vp.name}] Service link clicked: dataset.selectedService=${selectedService}, placeholder="${placeholder}"`);
      if (selectedService !== 'Saloon') {
        report.issues.push(`[${vp.name}] Service link did not set form.dataset.selectedService to Saloon.`);
      }
    }

    // Test Gallery Filters
    const filters = page.locator('.filter');
    const filterCount = await filters.count();
    console.log(`[${vp.name}] Gallery filters found: ${filterCount}`);
    for (let f = 0; f < filterCount; f++) {
      const filterBtn = filters.nth(f);
      const filterName = await filterBtn.getAttribute('data-filter');
      await filterBtn.click();
      const isActive = await filterBtn.evaluate(el => el.classList.contains('active'));
      const galleryItems = await page.locator('#gallery article').count();
      console.log(`[${vp.name}] Filter "${filterName}": active=${isActive}, items=${galleryItems}`);
      if (!isActive || galleryItems === 0) {
        report.issues.push(`[${vp.name}] Filter "${filterName}" failed or returned 0 items.`);
      }
    }
    // Reset to All
    await filters.first().click();

    // Test Packages Section
    const packageCards = page.locator('.package-card');
    const packageCount = await packageCards.count();
    console.log(`[${vp.name}] Package cards found: ${packageCount}`);
    if (packageCount === 0) {
      report.issues.push(`[${vp.name}] No package cards found.`);
    } else {
      // Click first package (Wedding Package 1)
      await packageCards.first().click();
      const eventVal = await page.locator('#booking-form select[name="event"]').inputValue();
      const pkgVal = await page.locator('#booking-form select[name="package"]').inputValue();
      console.log(`[${vp.name}] Clicked Wedding Package 1 -> event=${eventVal}, pkg=${pkgVal}`);
      if (eventVal !== 'Wedding' || pkgVal !== 'Wedding Package 1') {
        report.issues.push(`[${vp.name}] Package card Wedding Package 1 did not set event and package select.`);
      }

      // Click an Event package (e.g., Event Package 1)
      const eventPkgCard = page.locator('.package-card[data-package="Event Package 1"]');
      if (await eventPkgCard.count() > 0) {
        await eventPkgCard.click();
        const evVal2 = await page.locator('#booking-form select[name="event"]').inputValue();
        const pkgVal2 = await page.locator('#booking-form select[name="package"]').inputValue();
        console.log(`[${vp.name}] Clicked Event Package 1 -> event=${evVal2}, pkg=${pkgVal2}`);
      }

      // Click a Social Media package (e.g. Basic)
      const socialPkgCard = page.locator('.package-card[data-package="Basic"]');
      if (await socialPkgCard.count() > 0) {
        await socialPkgCard.click();
        const evVal3 = await page.locator('#booking-form select[name="event"]').inputValue();
        const pkgVal3 = await page.locator('#booking-form select[name="package"]').inputValue();
        console.log(`[${vp.name}] Clicked Basic -> event=${evVal3}, pkg=${pkgVal3}`);
      }
    }

    // Test Enquiry Package Choice Buttons
    const enquiryChoices = page.locator('.enquiry-package-option');
    const enquiryChoicesCount = await enquiryChoices.count();
    console.log(`[${vp.name}] Enquiry package choices count: ${enquiryChoicesCount}`);
    if (enquiryChoicesCount > 0) {
      const firstChoice = enquiryChoices.first();
      await firstChoice.click();
      const pkgValChoice = await page.locator('#booking-form select[name="package"]').inputValue();
      console.log(`[${vp.name}] Clicked enquiry choice -> pkg=${pkgValChoice}`);
    }

    // Test Event dropdown changing
    const eventSelect = page.locator('#booking-form select[name="event"]');
    await eventSelect.selectOption('Birthday');
    const optionsBirthday = await page.locator('#booking-form select[name="package"] option').allTextContents();
    console.log(`[${vp.name}] Birthday packages options:`, optionsBirthday);

    await eventSelect.selectOption('Other');
    const optionsOther = await page.locator('#booking-form select[name="package"] option').allTextContents();
    console.log(`[${vp.name}] Other packages options:`, optionsOther);

    // Test General Message disclosure form
    const disclosure = page.locator('.message-disclosure');
    if (await disclosure.count() > 0) {
      console.log(`[${vp.name}] Testing contact message disclosure...`);
      await page.locator('.message-disclosure summary').click();
      const isOpen = await disclosure.evaluate(el => el.open);
      console.log(`[${vp.name}] Disclosure open: ${isOpen}`);
      if (!isOpen) {
        report.issues.push(`[${vp.name}] Disclosure did not open.`);
      }
    }

    // Test Photoshoots Page
    console.log(`[${vp.name}] Loading http://localhost:3000/photoshoots.html ...`);
    await page.goto('http://localhost:3000/photoshoots.html', { waitUntil: 'networkidle' });

    const photoTiles = page.locator('.photo-tile');
    const photoCount = await photoTiles.count();
    console.log(`[${vp.name}] Photoshoot tiles count: ${photoCount}`);
    if (photoCount === 0) {
      report.issues.push(`[${vp.name}] Photoshoot page has no photo tiles.`);
    } else {
      // Test Lightbox open
      console.log(`[${vp.name}] Clicking first photo tile to open lightbox...`);
      await photoTiles.first().click();
      const lightbox = page.locator('#photoLightbox');
      const isHidden = await lightbox.getAttribute('hidden');
      const captionText = await lightbox.locator('figcaption').textContent();
      const imgSource = await lightbox.locator('figure img').getAttribute('src');
      console.log(`[${vp.name}] Lightbox: hidden=${isHidden}, caption="${captionText}", img="${imgSource}"`);
      if (isHidden !== null && isHidden !== 'false') {
        report.issues.push(`[${vp.name}] Lightbox did not open on tile click.`);
      }

      // Test next button
      await lightbox.locator('.lightbox-next').click();
      const captionNext = await lightbox.locator('figcaption').textContent();
      console.log(`[${vp.name}] Lightbox next clicked -> caption: "${captionNext}"`);
      if (captionNext === captionText) {
        report.issues.push(`[${vp.name}] Lightbox next did not advance photo.`);
      }

      // Test prev button
      await lightbox.locator('.lightbox-prev').click();
      const captionPrev = await lightbox.locator('figcaption').textContent();
      console.log(`[${vp.name}] Lightbox prev clicked -> caption: "${captionPrev}"`);

      // Test close button
      await lightbox.locator('.lightbox-close').click();
      const isClosed = await lightbox.getAttribute('hidden');
      console.log(`[${vp.name}] Lightbox closed: hidden=${isClosed}`);
      if (isClosed === null) {
        report.issues.push(`[${vp.name}] Lightbox did not close on close button click.`);
      }

      // Test keyboard navigation (open again, press ArrowRight, press Escape)
      await photoTiles.nth(1).click();
      await page.keyboard.press('ArrowRight');
      const captionKey = await lightbox.locator('figcaption').textContent();
      console.log(`[${vp.name}] ArrowRight pressed -> caption: "${captionKey}"`);
      await page.keyboard.press('Escape');
      const isClosedKey = await lightbox.getAttribute('hidden');
      if (isClosedKey === null) {
        report.issues.push(`[${vp.name}] Lightbox did not close on Escape key.`);
      }
    }

    // Check Back link on photoshoots page
    const backBtn = page.locator('.header .button-small');
    const backHref = await backBtn.getAttribute('href');
    console.log(`[${vp.name}] Photoshoots back button href: ${backHref}`);

    await context.close();
  }

  await browser.close();

  console.log('\n================ AUDIT REPORT ================');
  console.log('Console Errors:', JSON.stringify(report.consoleErrors, null, 2));
  console.log('Console Warnings:', JSON.stringify(report.consoleWarnings, null, 2));
  console.log('Failed Requests:', JSON.stringify(report.failedRequests, null, 2));
  console.log('Issues Found:', JSON.stringify(report.issues, null, 2));
  return report;
}

runTestSuite().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});

