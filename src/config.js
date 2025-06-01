require('dotenv').config();

module.exports = {
  BING_URL: 'https://www.bing.com',
  MS_LOGIN_BTN: '#id_l',
  EMAIL_INPUT: '#usernameEntry',
  PASSWORD_INPUT: '#passwordEntry',
  PRIMARY_BTN: 'button[data-testid="primaryButton"]',
  SECONDARY_BTN: 'button[data-testid="secondaryButton"]',
  REWARDS_ICON: 'span.points-container[data-tag="RewardsHeader.Counter"]',
  REWARD_PANEL: '#rewid-f',
  IFRAME_SELECTOR: '#rewid-f > iframe',
  THREE_OFFERS_SELECTOR: '#bingRewards > div > div.flyout_control_threeOffers',
  EXCLUSIVE_CONTAINER_SELECTOR: '#exclusive_promo_cont',
  SECONDARY_OFFERS_CONTAINER: '#bingRewards > div > div:nth-child(7)',
  SEARCH_INPUT: '#sb_form_q',
  // ...
  MS_EMAIL: process.env.MS_EMAIL,
  MS_PASSWORD: process.env.MS_PASSWORD,

  // proxy settings
  PROXY_SERVER: process.env.PROXY_SERVER || '',
  PROXY_USERNAME: process.env.PROXY_USERNAME || '',
  PROXY_PASSWORD: process.env.PROXY_PASSWORD || '',

  MONGO_URI: process.env.MONGO_URI,
  ENC_KEY: process.env.ENC_KEY, // 32-byte key, ví dụ: 32 ký tự hex
  ENC_IV: process.env.ENC_IV, // 16-byte IV, ví dụ: 16 ký tự hex
};
