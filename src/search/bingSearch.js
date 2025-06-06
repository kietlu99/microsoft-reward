const { generateRandomKeywords } = require('../utils/keywordGenerator');
const ProxyAccount = require('../db/ProxyAccount');
const { SEARCH_INPUT } = require('../config');
const { delay, log } = require('../utils');

module.exports = async function bingSearch(page, account) {
  try {
    // 1. Kiểm tra phần tử thông báo điểm
    const rewardSelector =
      '#bingRewards > div > div:nth-child(6) > div > a > div.fp_row.align-top.promo_card > div.fc_dyn > div:nth-child(1) > div > p';

    const exists = await page.$(rewardSelector);
    if (exists) {
      const text = await page.$eval(rewardSelector, (el) =>
        el.innerText.trim()
      );
      if (
        text === 'You earned 30 points already!' ||
        text === 'You earned 90 points already!'
      ) {
        log(`🛑 Đã đạt điểm tìm kiếm: "${text}", bỏ qua phần tìm kiếm.`);
        return;
      }
    }
  } catch (err) {
    log(
      '⚠️ Không thể kiểm tra trạng thái điểm trước khi tìm kiếm:',
      err.message
    );
  }

  const already = account.searchedKeywords || [];
  const TARGET = 3;
  let candidates = [];

  // 1) Sinh dư đôi, sau đó loại trùng với already
  while (candidates.length < TARGET) {
    // Lấy 2× so lượng cần để dễ lọc trùng
    const more = generateRandomKeywords(TARGET * 2);
    for (const w of more) {
      if (
        candidates.length < TARGET &&
        !already.includes(w) &&
        !candidates.includes(w)
      ) {
        candidates.push(w);
      }
    }
  }

  log(`[${account.email}] 🔑 Từ khóa sinh tự động:`, candidates);

  await page.goto('https://www.bing.com', { waitUntil: 'networkidle2' });

  for (let i = 0; i < candidates.length; i++) {
    const kw = candidates[i];

    await page.waitForSelector(SEARCH_INPUT);
    await page.click(SEARCH_INPUT, { clickCount: 3 }, { delay: 1000 });
    await page.type(SEARCH_INPUT, kw, { delay: 500 });
    await page.keyboard.press('Enter');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    log(`[${account.email}] 🔍 Searched: ${kw}`);

    // Cập nhật vào DB ngay sau khi tìm xong
    await ProxyAccount.updateOne(
      { email: account.email },
      { $push: { searchedKeywords: kw } }
    );

    // // Chờ sau mỗi 4 từ: 15 phút, các lần khác: 3s
    // if ((i + 1) % 4 === 0 && i < candidates.length - 1) {
    //   log(`[${account.email}] ⏸️ Đã tìm ${i + 1} từ, nghỉ 15 phút...`);
    //   await delay(15 * 60 * 1000);
    // } else if (i < candidates.length - 1) {
    //   await delay(3000);
    // }

    await delay(7000);
  }

  log(`[${account.email}] ✅ Hoàn tất 30 từ khóa`);
};
