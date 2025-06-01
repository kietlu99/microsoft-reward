// src/utils/crypto.js
const crypto = require('crypto');
const { ENC_KEY, ENC_IV } = require('../config');

const algorithm = 'aes-256-cbc';
const secretKey = Buffer.from(ENC_KEY, 'hex'); // Đúng 32 bytes
const iv = Buffer.from(ENC_IV, 'hex'); // Đúng 16 bytes

function encrypt(text) {
  const cipher = crypto.createCipheriv(algorithm, secretKey, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

const decrypt = (encrypted) => {
  const decipher = crypto.createDecipheriv(algorithm, secretKey, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

module.exports = { encrypt, decrypt };
