// src/data/importExcel.js
const xlsx = require('xlsx');
const moment = require('moment-timezone');
const { encrypt } = require('../utils/crypto');
const mongoose = require('../db/mongoose');
const ProxyAccount = require('../db/ProxyAccount');
const path = require('path');

/**
 * Trả về thời gian hiện tại ở múi giờ VN (Asia/Ho_Chi_Minh)
 */
function nowVN() {
  return moment().tz('Asia/Ho_Chi_Minh').format('YYYY-MM-DD HH:mm:ss');
}

async function importFromExcel(filePath) {
  // 1. Đọc workbook
  const wb = xlsx.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1 });

  // 2. Duyệt từng dòng (tính cả header nếu có, bắt đầu từ i=0)
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const [proxyRaw, emailRaw, pwdRaw] = row;

    console.log(`👉 Dòng ${i + 1} raw:`, row);

    // Nếu email hoặc mật khẩu trống, bỏ qua
    if (!emailRaw || !pwdRaw) {
      console.warn(
        `⚠️ Dòng ${i + 1} bị bỏ qua: thiếu email hoặc mật khẩu`,
        row
      );
      continue;
    }

    const email = String(emailRaw).trim();
    const pwd = String(pwdRaw).trim();

    if (!email || !pwd) {
      console.warn(
        `⚠️ Dòng ${i + 1} bị bỏ qua: email/mật khẩu trống sau trim`,
        row
      );
      continue;
    }

    // Tính timestamps
    const createdAtVN = nowVN();
    const updatedAtVN = createdAtVN;

    // 3. Xác định xem có proxy hay không: nếu proxyRaw === 'none' (không phân biệt hoa thường) hoặc trống
    const raw = String(proxyRaw || '').trim();
    const hasProxyData = raw && raw.toLowerCase() !== 'none';

    let proxyObj = null;
    if (hasProxyData) {
      const parts = raw.split(':');
      if (parts.length < 4) {
        console.warn(
          `⚠️ Dòng ${i + 1} proxy không hợp lệ (cần ít nhất 4 phần):`,
          raw
        );
      } else {
        const [host, portStr, user, pass, protocol = 'HTTP'] = parts;
        const port = parseInt(portStr, 10);

        if (!host || isNaN(port)) {
          console.warn(
            `⚠️ Dòng ${i + 1} proxy không hợp lệ (host hoặc port):`,
            raw
          );
        } else {
          proxyObj = {
            host,
            port,
            username: encrypt(String(user || '').trim()),
            password: encrypt(String(pass || '').trim()),
            protocol: String(protocol || 'HTTP').toUpperCase(),
          };
        }
      }
    }

    try {
      // 4. Chuẩn bị các trường cần cập nhật vào DB
      const updateFields = {
        email,
        emailPassword: encrypt(pwd),
        active: true,
        streak: true,
        updatedAtVN,
        complete: false,
        // Nếu không có proxyObj, vẫn cho chạy nhưng đánh dấu proxyAlive=false
        proxyAlive: proxyObj ? true : false,
        // createdAtVN sẽ chỉ được set khi insert mới
      };

      if (proxyObj) {
        updateFields.proxy = proxyObj;
      }

      // 5. Thực hiện upsert (insert nếu chưa có, update nếu đã tồn tại)
      await ProxyAccount.findOneAndUpdate(
        { email }, // điều kiện tìm theo email
        {
          $set: updateFields,
          $setOnInsert: { createdAtVN },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      console.log(`✔️ Đã lưu/cập nhật account dòng ${i + 1} (${email})`);
    } catch (e) {
      console.error(`❌ Lỗi lưu account dòng ${i + 1}:`, e.message);
    }
  }

  console.log('🚀 Import xong tất cả dòng.');
  mongoose.disconnect();
}

// Nếu chạy trực tiếp file này bằng `node importExcel.js <file>`, gọi hàm
if (require.main === module) {
  const file =
    process.argv[2] || path.join(__dirname, '../../data/proxies.xlsx');
  importFromExcel(file);
}

module.exports = importFromExcel;
