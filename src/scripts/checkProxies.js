// src/scripts/checkProxies.js
require('dotenv').config();
const xlsx = require('xlsx');
const mongoose = require('../db/mongoose');
const ProxyAccount = require('../db/ProxyAccount');
const { encrypt, decrypt } = require('../utils/crypto');
const path = require('path');
const axios = require('axios');
const { HttpsProxyAgent, HttpProxyAgent } = require('https-proxy-agent');

const EXCEL_INPUT = path.join(__dirname, '../../data/proxies.xlsx');
const EXCEL_OUTPUT = path.join(__dirname, '../../data/dead_proxies.xlsx');

/**
 * Đọc file Excel, trả về mảng mỗi dòng dưới dạng [proxyRaw, email, pwd]
 */
function readExcel(filePath) {
  const wb = xlsx.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  return xlsx.utils.sheet_to_json(ws, { header: 1 });
}

/**
 * Ghi mảng rows (mỗi row là mảng giá trị) ra file Excel mới
 */
function writeExcel(rows, filePath) {
  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.aoa_to_sheet(rows);
  xlsx.utils.book_append_sheet(wb, ws, 'dead_proxies');
  xlsx.writeFile(wb, filePath);
}

/**
 * Kiểm tra proxy có thể request https://www.bing.com thành công hay không.
 * Trả về true nếu không timeout, false nếu lỗi (timeout, unreachable…).
 */
async function testProxy({ host, port, user, pass, protocol }) {
  try {
    // Tạo proxy URL: ví dụ "http://user:pass@host:port"
    const credentials = user && pass ? `${user}:${pass}@` : '';
    const proxyUrl = `${protocol.toLowerCase()}://${credentials}${host}:${port}`;

    // Khởi tạo agent tương ứng
    const agent =
      protocol.toLowerCase() === 'https'
        ? new HttpsProxyAgent(proxyUrl)
        : new HttpProxyAgent(proxyUrl);

    // Gửi request tới Bing
    const response = await axios.get('https://www.bing.com', {
      timeout: 5000,
      httpAgent: agent,
      httpsAgent: agent,
      validateStatus: () => true, // Bỏ qua status code
    });

    return !!response;
  } catch {
    return false;
  }
}

(async () => {
  // 1. Kết nối MongoDB
  await mongoose.connect(process.env.MONGO_URI);
  console.log('[DB] Connected to', process.env.MONGO_URI);

  // 2. Đọc Excel đầu vào
  const rows = readExcel(EXCEL_INPUT);
  // Nếu có header, bỏ dòng đầu nếu cần: rows.shift();

  const deadList = [];

  for (let i = 0; i < rows.length; i++) {
    const [proxyRaw, emailEncrypted, pwdEncrypted] = rows[i];
    if (!proxyRaw) continue;

    // 3. Parse proxyRaw thành host, port, user, pass, protocol
    const parts = proxyRaw.split(':');
    if (parts.length < 4) {
      console.warn(`⚠️ Dòng ${i + 1} proxy không hợp lệ: ${proxyRaw}`);
      continue;
    }
    const [host, port, userEnc, passEnc, protocol = 'HTTP'] = parts;

    // 4. Giải mã user/pass nếu cần
    let user = userEnc,
      pass = passEnc;
    try {
      user = decrypt(userEnc);
      pass = decrypt(passEnc);
    } catch {
      // giữ nguyên nếu không mã hoá
    }

    console.log(`🔎 Kiểm tra proxy ${host}:${port} (dòng ${i + 1})`);
    const alive = await testProxy({ host, port, user, pass, protocol });
    console.log(`  → ${alive ? '✅ Còn sống' : '❌ Đã chết'}`);

    // 5. Giải mã email để dùng làm query trong DB
    let email = emailEncrypted;
    try {
      email = decrypt(emailEncrypted);
    } catch {
      // giữ nguyên nếu không mã hoá
    }

    // 6. Cập nhật proxyAlive trong MongoDB
    await ProxyAccount.findOneAndUpdate(
      { email: email.trim() },
      { proxyAlive: alive },
      { new: true }
    );

    // 7. Nếu proxy chết, push vào deadList để xuất file
    if (!alive) {
      deadList.push([proxyRaw, email, pwdEncrypted]);
    }
  }

  // 8. Xuất file Excel chỉ chứa proxy chết
  if (deadList.length) {
    const header = [['Proxy', 'Email', 'Password']];
    writeExcel(header.concat(deadList), EXCEL_OUTPUT);
    console.log(
      `📁 Đã xuất ${deadList.length} proxy chết vào: ${EXCEL_OUTPUT}`
    );
  } else {
    console.log('🎉 Không có proxy nào chết, không tạo file Excel.');
  }

  await mongoose.disconnect();
  console.log('[DB] Disconnected');
})();
