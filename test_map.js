const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:4174');
  await page.waitForTimeout(2000);

  // check height of the Map container
  const mapHeight = await page.evaluate(() => {
    const map = document.querySelector('.public-home');
    return map ? map.clientHeight : 0;
  });
  console.log('Public home height:', mapHeight);

  const mapComponentHeight = await page.evaluate(() => {
    const mapContainer = document.querySelector('div[style*="height: 100vh"]');
    return mapContainer ? mapContainer.clientHeight : 0;
  });
  console.log('Map component container height:', mapComponentHeight);

  const mapInnerHeight = await page.evaluate(() => {
    // google maps creates a div. Let's find one that looks like google maps
    const map = document.querySelector('div[style*="z-index: 0"] > div');
    return map ? map.clientHeight : -1;
  });
  console.log('Map inner element height:', mapInnerHeight);

  await page.screenshot({ path: 'map_test.png' });
  await browser.close();
})();
