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
  // PHẦN 3: Secondary Offers – tự động tìm container chứa các offers phù hợp
  const possibleContainers = [
    '#bingRewards > div > div:nth-child(8)',
    '#bingRewards > div > div:nth-child(7)',
    '#bingRewards > div > div:nth-child(6)',
    '#bingRewards > div > div.flyout_control_halfUnit',
  ];

  let containerSelector = null;

  // 1) Tìm container đầu tiên chứa các div con với aria phù hợp
  for (const sel of possibleContainers) {
    // Lấy tất cả div con
    const divs = await page.$$(sel + ' > div');
    console.log(divs);
    let found = false;

    for (let i = 0; i < divs.length; i++) {
      const aria = await divs[i].evaluate(
        (el) => el.getAttribute('aria-label')?.trim() || ''
      );
      const hasA = (await divs[i].$('a')) !== null;
      if (
        (aria === 'Offer not Completed' || aria === 'Offer is Completed') &&
        hasA
      ) {
        found = true;
        break;
      }
    }

    if (found) {
      containerSelector = sel;
      log(`▶️ Dùng SECONDARY_OFFERS_CONTAINER = ${sel}`);
      break;
    }
  }

  if (!containerSelector) {
    log(
      '⚠️ Không tìm thấy bất kỳ secondary offers container nào có offer phù hợp.'
    );
  } else {
    // 2) Lấy danh sách offers phù hợp
    const offers = await page.$$eval(`${containerSelector} > div`, (divs) =>
      divs
        .map((div, i) => {
          const aria = div.getAttribute('aria-label')?.trim() || '';
          const a = div.querySelector('a');
          if (
            (aria === 'Offer not Completed' || aria === 'Offer is Completed') &&
            a
          ) {
            return { idx: i + 1, aria, href: a.href, target: a.target };
          }
        })
        .filter(Boolean)
    );
    log(`▶️ Tìm thấy ${offers.length} offers có aria phù hợp`);

    // 3) Xử lý các offer chưa hoàn thành
    for (const { idx, aria, href, target } of offers) {
      log(`• Offer child #${idx}: aria-label="${aria}"`);
      if (aria !== 'Offer not Completed') {
        log(`⏭️ Offer #${idx} đã hoàn thành, bỏ qua.`);
        continue;
      }

      const linkSel = `${containerSelector} > div:nth-child(1) > a[href="${href}"]`;
      await page.waitForSelector(linkSel, { timeout: 5000 });

      if (target === '_blank') {
        await page.click(linkSel);
        const pages = await browser.pages();
        const newTab = pages[pages.length - 1];
        await delay(5000);
        await newTab.close();
        await page.bringToFront();
        log(`🔒 Đã đóng tab mới: ${href}`);
      } else {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle2' }),
          page.click(linkSel),
        ]);
        log(`✅ Vào offer same-tab: ${href}`);
        await delay(5000);
        await page.goBack({ waitUntil: 'networkidle2' });
      }

      await page.waitForSelector(containerSelector, { timeout: 10000 });
      await delay(5000);
    }

    log('🏁 Hoàn thành xử lý tất cả secondary offers');
  }

  log('🏁 Hoàn thành xử lý tất cả offers');
};
