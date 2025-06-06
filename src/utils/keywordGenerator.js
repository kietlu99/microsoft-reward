// src/utils/keywordGenerator.js
const { generate } = require('random-words');

/**
 * Sinh ngẫu nhiên N từ tiếng Anh có độ dài từ 4 đến 8 ký tự,
 * đảm bảo không trùng lặp giữa các từ trong mảng kết quả.
 *
 * @param {number} N Số từ cần sinh
 * @returns {string[]} Mảng N từ khóa ngẫu nhiên (lowercase)
 */
function generateRandomKeywords(N) {
  const resultSet = new Set();

  // Tiếp tục sinh thêm đến khi đủ N từ
  while (resultSet.size < N) {
    // Sinh dư gấp đôi số cần (có thể thay đổi nếu cần hiệu năng)
    const batchSize = (N - resultSet.size) * 2;

    // generate options: exactly=batchSize, minLength=4, maxLength=8
    const batch = generate({
      exactly: batchSize,
      minLength: 4,
      maxLength: 8,
    });

    // batch có thể là string (nếu batchSize=1) hoặc array
    const arr = Array.isArray(batch) ? batch : [batch];

    for (const w of arr) {
      if (resultSet.size >= N) break;
      // đảm bảo không có khoảng trắng dư và đúng độ dài
      const word = w.trim().toLowerCase();
      if (word.length >= 4 && word.length <= 8) {
        resultSet.add(word);
      }
    }
  }

  return Array.from(resultSet);
}

module.exports = { generateRandomKeywords };
