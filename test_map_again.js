const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:4174');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'map_test_after.png' });
  await browser.close();
})();
