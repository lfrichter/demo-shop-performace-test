import { expect, Page, test } from '@playwright/test';

// 📊 PERFORMANCE HELPER FUNCTION
async function measurePerformance(page: Page, stepName: string) {
  await page.waitForLoadState('networkidle');

  const metrics = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const paint = performance.getEntriesByType('paint');
    const fcp = paint.find(p => p.name === 'first-contentful-paint');

    return {
      duration: Math.round(nav?.duration || 0),
      domComplete: Math.round(nav?.domComplete || 0),
      fcp: Math.round(fcp ? fcp.startTime : 0)
    };
  });

  console.log(`⏱️ [Perf - ${stepName}] Load: ${metrics.duration}ms | FCP: ${metrics.fcp}ms`);

  // --- SEND METRICS TO INFLUXDB ---
  const timestamp = Date.now() * 1000000;
  // Replace spaces with underscores for Line Protocol compatibility
  const cleanStep = stepName.replace(/\s+/g, '_');

  const lineProtocol = `ui_metrics,step=${cleanStep} load_time=${metrics.duration},dom_interactive=${metrics.domComplete},fcp=${metrics.fcp} ${timestamp}`;
  const INFLUX_HOST = process.env.INFLUX_URL || 'http://localhost:8086';

  try {
    await fetch(`${INFLUX_HOST}/write?db=playwright`, {
      method: 'POST',
      body: lineProtocol
    });
    console.log(`   ↳ 📡 Metrics sent to InfluxDB`);
  } catch (error) {
    console.error(`   ↳ ❌ Failed to send metrics: ${error}`);
  }
  console.log('------------------------------------------------');
}

test.describe('E-Commerce Frontend Performance', () => {

  // Global timeout increased for slower demo environments
  test.setTimeout(60000);

  test('Should complete end-to-end checkout flow and measure visual performance', async ({ page }) => {

    const randomId = Math.floor(Math.random() * 100000);
    const user = {
      email: `pw.perf.${randomId}@example.com`,
      password: 'Password123!',
      firstName: 'Playwright',
      lastName: 'Benchmark'
    };

    // --- STEP 1: USER REGISTRATION ---
    await test.step('1. User Registration', async () => {
      await page.goto('https://demowebshop.tricentis.com/register');

      await page.locator('#gender-male').check();
      await page.locator('#FirstName').fill(user.firstName);
      await page.locator('#LastName').fill(user.lastName);
      await page.locator('#Email').fill(user.email);
      await page.locator('#Password').fill(user.password);
      await page.locator('#ConfirmPassword').fill(user.password);

      await page.locator('#register-button').click();

      await expect(page.locator('.result')).toContainText('Your registration completed');

      await measurePerformance(page, 'User_Registration');
    });

    // --- STEP 2: SEARCH & ADD TO CART ---
    await test.step('2. Product Search and Cart', async () => {
      await page.locator('#small-searchterms').fill('14.1-inch Laptop');
      await page.locator('input[value="Search"]').click();

      await page.locator('.product-title > a', { hasText: '14.1-inch Laptop' }).click();
      await expect(page.locator('h1[itemprop="name"]')).toContainText('14.1-inch Laptop');

      await measurePerformance(page, 'Product_Page');

      // Add to Cart and wait for notification
      await page.locator('.add-to-cart-button').first().click();
      const notification = page.locator('#bar-notification');
      await expect(notification).toBeVisible();
      await expect(notification).toContainText('The product has been added');

      // Close notification to prevent overlay issues
      await page.locator('.close').click();
      await expect(notification).toBeHidden();
    });

    // --- STEP 3: CHECKOUT WIZARD ---
    await test.step('3. Checkout Flow', async () => {
      await page.goto('https://demowebshop.tricentis.com/cart');
      await page.locator('#termsofservice').check();
      await page.locator('#checkout').click();

      // --- Billing Address ---
      await expect(page.locator('#opc-billing')).toBeVisible();
      if (await page.locator('#BillingNewAddress_CountryId').isVisible()) {
          await page.locator('#BillingNewAddress_CountryId').selectOption('1'); // USA
          await page.locator('#BillingNewAddress_City').fill('New York');
          await page.locator('#BillingNewAddress_Address1').fill('5th Avenue');
          await page.locator('#BillingNewAddress_ZipPostalCode').fill('10001');
          await page.locator('#BillingNewAddress_PhoneNumber').fill('1234567890');
      }
      await page.locator('#billing-buttons-container .new-address-next-step-button').click();
      await expect(page.locator('.loading-image')).toBeHidden();

      // --- Shipping Address (Conditional) ---
      const shippingAddressContainer = page.locator('#shipping-buttons-container');
      try {
        await shippingAddressContainer.waitFor({ state: 'visible', timeout: 2000 });
      } catch (e) {}

      if (await shippingAddressContainer.isVisible()) {
          console.log('[Info] Handling explicit Shipping Address step...');
          await shippingAddressContainer.locator('.new-address-next-step-button').click();
          await expect(page.locator('.loading-image')).toBeHidden();
      }

      // --- Shipping Method ---
      await expect(page.locator('#checkout-step-shipping-method')).toBeVisible();
      const shippingMethodBtn = page.locator('#shipping-method-buttons-container .shipping-method-next-step-button');
      await shippingMethodBtn.click();
      await expect(page.locator('.loading-image')).toBeHidden();

      // --- Payment Method ---
      // Wait for accordion expansion
      await expect(page.locator('#checkout-step-payment-method')).toBeVisible({ timeout: 10000 });

      const paymentMethodBtn = page.locator('#payment-method-buttons-container .payment-method-next-step-button');
      await expect(paymentMethodBtn).toBeVisible();
      await paymentMethodBtn.click();
      await expect(page.locator('.loading-image')).toBeHidden();

      // --- Payment Info ---
      await expect(page.locator('#checkout-step-payment-info')).toBeVisible({ timeout: 10000 });

      const paymentInfoBtn = page.locator('#payment-info-buttons-container .payment-info-next-step-button');
      await expect(paymentInfoBtn).toBeVisible();
      await paymentInfoBtn.click();
      await expect(page.locator('.loading-image')).toBeHidden();

      // --- Confirm Order ---
      await expect(page.locator('#checkout-step-confirm-order')).toBeVisible({ timeout: 10000 });

      const confirmBtn = page.locator('#confirm-order-buttons-container .confirm-order-next-step-button');
      await expect(confirmBtn).toBeVisible();
      await confirmBtn.click();
      await expect(page.locator('.loading-image')).toBeHidden();
    });

    // --- STEP 4: VALIDATION ---
    await test.step('4. Order Validation', async () => {
      await expect(page.locator('.section.order-completed')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('.title')).toContainText('Your order has been successfully processed');

      const orderText = await page.locator('.details > li').first().innerText();
      console.log(`✅ [Success] Order Generated: ${orderText}`);

      await measurePerformance(page, 'Order_Success_Page');
    });

  });
});
