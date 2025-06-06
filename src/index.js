// src/index.js

require('dotenv').config();
const mongoose = require('mongoose');
const puppeteer = require('puppeteer');
const login = require('./auth/login');
const openRewards = require('./rewards/openPanel');
const processOffers = require('./rewards/processOffers');
const bingSearch = require('./search/bingSearch');
const ProxyAccount = require('./db/ProxyAccount');
const { decrypt } = require('./utils/crypto');
const { MONGO_URI } = require('./config');

(async () => {
  // 1. Kết nối MongoDB
  await mongoose.connect(MONGO_URI);
  console.log('[DB] Connected to', MONGO_URI);

  // 2. Lấy tất cả account
  const accounts = await ProxyAccount.find({ active: true });
  console.log(`🔑 Found ${accounts.length} accounts`);

  for (const acct of accounts) {
    // 3. Giải mã dữ liệu
    const proxy = acct.proxy;
    const proxyHost = proxy.host;
    const proxyPort = proxy.port;
    const proxyUser = decrypt(proxy.username);
    const proxyPass = decrypt(proxy.password);
    const proxyProtocol = proxy.protocol.toLowerCase(); // e.g. 'http'

    const email = acct.email;
    const emailPwd = decrypt(acct.emailPassword);

    console.log(
      `\n🚀 Running for ${email} via proxy ${proxyHost}:${proxyPort}`
    );

    // 4. Launch browser với proxy
    const browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      args: [
        `--proxy-server=${proxyProtocol}://${proxyHost}:${proxyPort}`,
        '--start-maximized',
      ],
      protocolTimeout: 600000,
    });
    const page = await browser.newPage();

    // 5. Authenticate nếu cần
    if (proxyUser && proxyPass) {
      await page.authenticate({ username: proxyUser, password: proxyPass });
      console.log('[Proxy] Authenticated');
    }

    // 6. Chạy flow với email này
    try {
      // Gọi login với email/password
      await login(page, email, emailPwd);
      await openRewards(page);
      await processOffers(page);
      await bingSearch(page, acct);
      console.log(`[OK] Completed for ${email}`);
    } catch (err) {
      console.error(`[ERR] Failed for ${email}:`, err);
    } finally {
      await browser.close();
      console.log(`[Clean] Closed browser for ${email}`);
    }
  }

  await mongoose.disconnect();
  console.log('[DB] Disconnected, all done');
})();
