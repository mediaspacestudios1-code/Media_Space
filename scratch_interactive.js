import { chromium } from 'playwright';

async function testInteractive() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push({ type: 'console.error', text: msg.text() });
  });
  page.on('pageerror', err => {
    errors.push({ type: 'pageerror', text: err.message });
  });

  await page.goto('http://localhost:3000');
  await page.waitForSelector('#load-screen', { state: 'detached', timeout: 15000 });

  console.log('Testing booking form submission with valid data...');
  await page.fill('#booking-form input[name="name"]', 'Systematic Tester');
  await page.fill('#booking-form input[name="phone"]', '+91 9876543210');
  await page.fill('#booking-form input[name="email"]', 'tester@mediaspace.example');
  await page.selectOption('#booking-form select[name="event"]', 'Wedding');
  await page.selectOption('#booking-form select[name="package"]', 'Wedding Package 1');
  await page.fill('#booking-form input[name="date"]', '2026-11-15');
  await page.fill('#booking-form input[name="place"]', 'Pollachi Palace');
  await page.fill('#booking-form textarea[name="message"]', 'Looking forward to coverage.');

  await page.click('#booking-form button[type="submit"]');

  await page.waitForTimeout(2000);
  const statusBooking = await page.textContent('#booking-form .form-status');
  console.log('Booking form status message:', statusBooking);

  console.log('Testing contact form submission...');
  await page.click('.message-disclosure summary');
  await page.fill('#contact-form input[name="name"]', 'Systematic Contact');
  await page.fill('#contact-form input[name="email"]', 'contact@mediaspace.example');
  await page.fill('#contact-form input[name="phone"]', '+91 9876543210');
  await page.fill('#contact-form input[name="subject"]', 'General Query');
  await page.fill('#contact-form textarea[name="message"]', 'Hello Media Space team, great website!');
  await page.click('#contact-form button[type="submit"]');

  await page.waitForTimeout(2000);
  const statusContact = await page.textContent('#contact-form .form-status');
  console.log('Contact form status message:', statusContact);

  console.log('Testing video card play click on service card...');
  const firstPlayIcon = page.locator('.service-card .play-icon').first();
  await firstPlayIcon.scrollIntoViewIfNeeded();
  await firstPlayIcon.click();
  await page.waitForTimeout(1000);
  const isPlaying = await page.locator('.service-card .service-media').first().evaluate(el => el.classList.contains('is-playing'));
  console.log('Service card video is-playing:', isPlaying);

  console.log('Testing video card play click on gallery reel...');
  const firstGalleryPlay = page.locator('.gallery-grid .play-icon').first();
  await firstGalleryPlay.scrollIntoViewIfNeeded();
  await firstGalleryPlay.click();
  await page.waitForTimeout(1000);
  const isGalleryPlaying = await page.locator('.gallery-grid .gallery-item').first().evaluate(el => el.classList.contains('is-playing'));
  console.log('Gallery video is-playing:', isGalleryPlaying);

  console.log('Interactive errors logged:', errors);
  await browser.close();
}

testInteractive().catch(console.error);

