const { SEARCH_INPUT } = require('../config');
const { delay, log } = require('../utils');

const keywords = [
  'galaxy',
  'shadow',
  'silence',
  'thunder',
  'mist',
  'fog',
  'cave',
  'path',
  'journey',
  'freedom',
  'courage',
  'magic',
  'mystery',
  'secret',
  'whisper',
  'echo',
  'flame',
  'crystal',
  'pearl',
  'shell',
  'wave',
  'breeze',
  'chill',
  'spark',
  'lantern',
  'feather',
  'root',
  'nest',
  'stone',
  'trail',
];

module.exports = async function bingSearch(page) {
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

  // 2. Nếu chưa đạt điểm, thực hiện tìm kiếm như thường
  await page.goto('https://www.bing.com', { waitUntil: 'networkidle2' });

  for (let i = 0; i < 3; i++) {
    await page.waitForSelector(SEARCH_INPUT);
    await page.click(SEARCH_INPUT, { clickCount: 3 }, { delay: 1000 });
    await page.type(SEARCH_INPUT, keywords[i], { delay: 500 });
    await page.keyboard.press('Enter');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    log(`Searched: ${keywords[i]}`);

    // if ((i + 1) % 4 === 0 && i < keywords.length - 1) {
    //   log('⏸️ Đã tìm 4 từ khóa, nghỉ 15 phút...');
    //   await delay(15 * 60 * 1000); // 15 phút
    // } else if (i < keywords.length - 1) {
    //   await delay(3000); // Delay giữa các từ khóa khác
    // }
  }
  k;
};
