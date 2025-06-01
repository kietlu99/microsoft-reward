// src/data/importExcel.js
const xlsx = require('xlsx');
const moment = require('moment-timezone');
const { encrypt } = require('../utils/crypto');
const mongoose = require('../db/mongoose');
const ProxyAccount = require('../db/ProxyAccount');
const path = require('path');

function nowVN() {
  return moment().tz('Asia/Ho_Chi_Minh').format('YYYY-MM-DD HH:mm:ss');
}

async function importFromExcel(filePath) {
  // 1. Đọc workbook
  const wb = xlsx.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1 });

  // 2. Bỏ header, duyệt từng dòng
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const [proxyRaw, email, pwd] = row;
    console.log(`👉 Dòng ${i + 1} raw:`, row); // Thêm dòng này

    if (!proxyRaw || !email || !pwd) {
      console.warn(`⚠️ Dòng ${i + 1} bị bỏ qua: thiếu dữ liệu`, row);
      continue;
    }

    const parts = proxyRaw.split(':');
    if (parts.length < 4) {
      console.warn(`⚠️ Dòng ${i + 1} proxy không hợp lệ:`, proxyRaw);
      continue;
    }

    const [host, port, user, pass, protocol = 'HTTP'] = parts;

    const createdAtVN = nowVN();
    const updatedAtVN = createdAtVN;

    try {
      await ProxyAccount.findOneAndUpdate(
        { email: email.trim() }, // điều kiện tìm
        {
          $set: {
            proxy: {
              host,
              port: Number(port),
              username: encrypt(user),
              password: encrypt(pass),
              protocol,
            },
            email: email.trim(),
            emailPassword: encrypt(pwd.trim()),
            active: true,
            streak: true,
            updatedAtVN, // cập nhật mỗi lần import
            complete: false, // mặc định chưa hoàn thành
            proxyAlive: true, // mặc định proxy còn sống
          },
          $setOnInsert: {
            createdAtVN, // chỉ thiết lập lần đầu
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      console.log(`✔️ Đã lưu (hoặc cập nhật) account dòng ${i + 1}`);
    } catch (e) {
      console.error(`❌ Lỗi lưu account dòng ${i + 1}:`, e.message);
    }
  }

  console.log('🚀 Import xong tất cả dòng.');
  mongoose.disconnect();
}

// Chạy script nếu gọi trực tiếp
if (require.main === module) {
  const file =
    process.argv[2] || path.join(__dirname, '../../data/proxies.xlsx');
  importFromExcel(file);
}

module.exports = importFromExcel;
