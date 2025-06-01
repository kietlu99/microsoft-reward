const { REWARDS_ICON, REWARD_PANEL, IFRAME_SELECTOR } = require('../config');
const { delay, log } = require('../utils');

module.exports = async function openRewardsPanel(page) {
  await page.waitForSelector(REWARDS_ICON);
  await page.$eval(REWARDS_ICON, (el) => el.closest('div.b_clickarea').click());
  await page.waitForSelector(REWARD_PANEL);
  log('Rewards panel opened');
  await page.waitForSelector(IFRAME_SELECTOR);
  const iframeSrc = await page.$eval(IFRAME_SELECTOR, (i) => i.src);
  await page.goto(iframeSrc, { waitUntil: 'networkidle2' });
  await delay(3000);
  log('Switched to rewards iframe');
};
