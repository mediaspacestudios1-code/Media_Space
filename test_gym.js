import { chromium } from 'playwright';

async function testGym() {
  const b = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await b.newPage();
  await page.goto('http://localhost:3000');
  await page.waitForSelector('#load-screen', { state: 'detached', timeout: 15000 });

  console.log('Clicking Gym service enquiry arrow...');
  const gymLink = page.locator('.service-card').first().locator('.service-link');
  await gymLink.click();

  const placeholder = await page.locator('#booking-form textarea[name="message"]').getAttribute('placeholder');
  const selectedService = await page.locator('#booking-form').evaluate(el => el.dataset.selectedService);
  console.log('Placeholder is:', placeholder);
  console.log('Selected service dataset is:', selectedService);

  await page.fill('#booking-form input[name="name"]', 'Gym Enquirer');
  await page.fill('#booking-form input[name="phone"]', '+91 9876543210');
  await page.fill('#booking-form input[name="email"]', 'gymenquirer@example.com');
  await page.selectOption('#booking-form select[name="event"]', 'Other');
  await page.selectOption('#booking-form select[name="package"]', 'Basic');
  await page.fill('#booking-form input[name="date"]', '2026-11-20');
  await page.fill('#booking-form input[name="place"]', 'Pollachi Fitness');

  await page.click('#booking-form button[type="submit"]');
  await page.waitForTimeout(2000);

  const status = await page.textContent('#booking-form .form-status');
  console.log('Submission status message:', status);

  await b.close();
}

testGym().catch(console.error);

