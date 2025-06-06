// src/rewards/processOffers.js
const { delay, log } = require('../utils');
const { TimeoutError } = require('puppeteer');
const {
  THREE_OFFERS_SELECTOR,
  EXCLUSIVE_CONTAINER_SELECTOR,
} = require('../config');
const { timeout } = require('puppeteer');

/**
 * Xử lý lần lượt các offer trên Bing Rewards panel.
 * @param {import('puppeteer').Page} page
 */
module.exports = async function processOffers(page) {
  const browser = page.browser();
  log('▶️ Bắt đầu xử lý offers');

  // PHẦN 1: Three Offers (nth-child 2,3,4)
  const firstOffers = [2, 3, 4];
  for (const n of firstOffers) {
    const sel = `${THREE_OFFERS_SELECTOR} > div:nth-child(${n}) > a`;
    try {
      await page.waitForSelector(sel, { timeout: 5000 });
      const href = await page.$eval(sel, (a) => a.href);
      log(`▶️ ThreeOffer #${n - 1}: ${href}`);

      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2' }),
        page.click(sel),
      ]);
      log(`✅ Vào ThreeOffer #${n - 1}`);

      await delay(3000);
      await page.goBack({ waitUntil: 'networkidle2' });
      log('🔙 Quay lại Rewards panel');

      await page.waitForSelector(THREE_OFFERS_SELECTOR, { timeout: 5000 });
    } catch (err) {
      log(`⚠️ Bỏ qua ThreeOffer #${n - 1}: ${err.message}`);
    }
  }

  // PHẦN 2: Exclusive promo
  // 1) Lấy danh sách href từ các <a> con trong exclusive containers
  const hrefs = await page.$$eval(
    `${EXCLUSIVE_CONTAINER_SELECTOR} a`,
    (anchors) => anchors.map((a) => a.href)
  );
  log(`▶️ Tìm thấy ${hrefs.length} exclusive links`);

  // 2) Duyệt từng href
  try {
    for (const href of hrefs) {
      // 2.a) Tìm lại anchor bằng href, chờ selector hiện
      const linkSelector = `${EXCLUSIVE_CONTAINER_SELECTOR} a[href="${href}"]`;
      await page.waitForSelector(linkSelector, { timeout: 5000 });

      // 2.b) Click + đợi navigation

      await Promise.all([
        // giảm timeout xuống ví dụ 5000ms thay vì 30000
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 5000 }),
        page.click(linkSelector),
      ]);
      log(`✅ Đã click và vào: ${href}`);

      // 2.c) Giả lập thao tác người dùng
      await delay(2000);

      // 2.d) Quay lại Rewards panel

      await page.goBack({ waitUntil: 'networkidle2', timeout: 5000 });
      log('🔙 Quay lại Rewards panel');

      // 2.e) Chờ panel render lại
      await page.waitForSelector(EXCLUSIVE_CONTAINER_SELECTOR, {
        timeout: 10000,
      });
      await delay(2000);
    }
  } catch (err) {
    log(`⚠️ Bỏ qua Exclusive promo: ${err.message}`);
  }

  // PHẦN 3: Secondary Offers – tự động điều chỉnh start index
  const possibleContainers = [
    '#bingRewards > div > div:nth-child(8)',
    '#bingRewards > div > div:nth-child(7)',
    '#bingRewards > div > div:nth-child(6)',
    '#bingRewards > div > div.flyout_control_halfUnit',
  ];

  let containerSelector;
  for (const sel of possibleContainers) {
    if (await page.$(sel)) {
      containerSelector = sel;
      log(`▶️ Dùng SECONDARY_OFFERS_CONTAINER = ${sel}`);
      break;
    }
  }

  if (!containerSelector) {
    log('⚠️ Không tìm thấy bất kỳ secondary offers container nào.');
  } else {
    // Kiểm tra có exclusive promo (nằm ở div:nth-child(1) trong container này) không
    const hasExclusive = Boolean(
      await page.$(`${EXCLUSIVE_CONTAINER_SELECTOR}`)
    );
    const startIdx = hasExclusive ? 3 : 1;
    log(`▶️ hasExclusive=${hasExclusive}, startIdx=${startIdx}`);

    // Đếm tổng số div con
    const total = await page.$$eval(
      `${containerSelector} > div`,
      (divs) => divs.length
    );
    log(`▶️ Có tổng cộng ${total} div trong container`);

    // Loop từ startIdx tới total
    for (let idx = startIdx; idx <= total; idx++) {
      const offerDiv = `${containerSelector} > div:nth-child(${startIdx})`;
      try {
        await page.waitForSelector(offerDiv, { timeout: 5000 });
        const aria = await page.$eval(
          offerDiv,
          (el) => el.getAttribute('aria-label')?.trim() || ''
        );
        log(`• Offer child #${idx}: aria-label="${aria}"`);

        if (aria === 'Offer not Completed') {
          const linkSel = `${offerDiv} > a`;
          await page.waitForSelector(linkSel, { timeout: 5000 });

          const { href, target } = await page.$eval(linkSel, (a) => ({
            href: a.href,
            target: a.target,
          }));
          log(`▶️ OfferNotCompleted child #${idx}: ${href} (target=${target})`);

          if (target === '_blank') {
            // 1) Click vào link, tab mới sẽ tự động mở
            await page.click(linkSel);

            // 2) Lấy danh sách tất cả trang, tab mới thường là tab cuối cùng
            const pages = await browser.pages();
            const newTab = pages[pages.length - 1];

            await delay(5000);

            // 3) Đóng tab mới ngay lập tức
            await newTab.close();

            // 4) Đảm bảo focus quay lại tab chính
            await page.bringToFront();

            log(`🔒 Đã đóng tab mới sau khi click: ${href}`);
          } else {
            await Promise.all([
              page.waitForNavigation({ waitUntil: 'networkidle2' }),
              page.click(linkSel),
            ]);
            log(`✅ Vào offer same-tab: ${href}`);
            await delay(5000);
            await page.goBack({ waitUntil: 'networkidle2' });
          }

          // Đợi panel render lại
          await page.waitForSelector(containerSelector, { timeout: 10000 });
          await delay(5000);
        } else {
          log(`⏭️ Offer child #${idx} đã hoàn thành, bỏ qua.`);
        }
      } catch (err) {
        log(`⚠️ Bỏ qua child #${idx}: ${err.message}`);
      }
    }

    log('🏁 Hoàn thành xử lý tất cả secondary offers');
  }

  log('🏁 Hoàn thành xử lý tất cả offers');
};
