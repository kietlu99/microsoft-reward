// src/runParallel.js

require('dotenv').config();
const mongoose = require('mongoose');
const puppeteer = require('puppeteer');

const login = require('./auth/login');
const openRewards = require('./rewards/openPanel');
const processOffers = require('./rewards/processOffers');
const bingSearch = require('./search/bingSearch');

const ProxyAccount = require('./db/ProxyAccount');
const { decrypt } = require('./utils/crypto');
const config = require('./config');

(async () => {
  // 1) Kết nối MongoDB
  await mongoose.connect(config.MONGO_URI);
  console.log('[DB] Connected to', config.MONGO_URI);

  // 2) Lấy danh sách accounts active
  const allAccounts = await ProxyAccount.find({ active: true });
  console.log(`🔑 Tổng số tài khoản: ${allAccounts.length}`);

  // 3) Biến index dùng làm “hàng đợi”
  let nextIndex = 0;
  const totalAccounts = allAccounts.length;

  // 4) Số worker (số luồng song song)
  const WORKER_COUNT = 1;

  // 5) Hàm worker: mỗi worker sẽ lấy batch 5 account, rồi tuần tự xử lý
  async function worker(workerId) {
    while (true) {
      // 5.a) Lấy 5 tài khoản kế tiếp
      if (nextIndex >= totalAccounts) break;
      const start = nextIndex;
      const end = Math.min(start + 1, totalAccounts);
      const batch = allAccounts.slice(start, end);
      nextIndex = end; // Cập nhật hàng đợi

      console.log(
        `[Worker ${workerId}] Xử lý tài khoản từ ${start} đến ${end - 1}`
      );

      // 5.b) Duyệt từng account trong batch (mỗi account sẽ khởi browser riêng)
      for (const acct of batch) {
        const proxy = acct.proxy || {};
        const host = proxy.host || '';
        const port = proxy.port || '';
        const proto = (proxy.protocol || 'http').toLowerCase();

        let proxyUser = '',
          proxyPass = '';
        if (proxy.username && proxy.password) {
          try {
            proxyUser = decrypt(proxy.username);
            proxyPass = decrypt(proxy.password);
          } catch {
            proxyUser = proxy.username;
            proxyPass = proxy.password;
          }
        }

        const email = acct.email;
        let emailPwd = '';
        try {
          emailPwd = decrypt(acct.emailPassword);
        } catch {
          emailPwd = acct.emailPassword;
        }

        console.log(
          `[Worker ${workerId}] → Chạy cho ${email}` +
            (host && port ? ` via proxy ${host}:${port}` : ' (không proxy)')
        );

        // 5.c) Chuẩn bị args cho launch
        const launchArgs = ['--start-maximized'];
        if (host && port) {
          launchArgs.unshift(`--proxy-server=${proto}://${host}:${port}`);
        }

        // 5.d) Launch browser mới
        const browser = await puppeteer.launch({
          headless: false,
          defaultViewport: null,
          executablePath: config.EDGE_PATH || undefined,
          args: launchArgs,
          protocolTimeout: 600000,
        });

        const page = await browser.newPage();

        // Nếu có proxyUser & proxyPass, authenticate
        if (host && port && proxyUser && proxyPass) {
          await page.authenticate({ username: proxyUser, password: proxyPass });
          console.log(`[Worker ${workerId}] [Proxy] Authenticated`);
        }

        try {
          // 5.e) Chạy flow login → openRewards → processOffers → bingSearch
          await login(page, email, emailPwd);
          await openRewards(page);
          await processOffers(page);
          await bingSearch(page, acct);

          // 5.f) Đánh dấu complete=true khi thành công
          await ProxyAccount.updateOne({ email }, { complete: true });
          console.log(`[Worker ${workerId}] ✔ ${email} hoàn thành`);
        } catch (err) {
          console.error(`[Worker ${workerId}] ❌ ${email} lỗi:`, err.message);
          // Nếu lỗi liên quan proxy, đánh dấu proxyAlive=false
          await ProxyAccount.updateOne({ email }, { proxyAlive: false });
        } finally {
          await browser.close();
          console.log(`[Worker ${workerId}] Đóng browser cho ${email}`);
        }
      }

      console.log(
        `[Worker ${workerId}] Đã xong batch, tiếp tục nếu còn tài khoản.`
      );
    }

    console.log(
      `[Worker ${workerId}] Không còn tài khoản để xử lý, kết thúc worker.`
    );
  }

  // 6) Khởi WORKER_COUNT worker đồng thời
  const workers = [];
  for (let i = 0; i < WORKER_COUNT; i++) {
    workers.push(worker(i + 1));
  }
  await Promise.all(workers);

  // 7) Ngắt kết nối DB
  await mongoose.disconnect();
  console.log('[DB] Disconnected. All done!');
})();
