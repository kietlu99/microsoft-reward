// src/db/ProxyAccount.js
const mongoose = require('./mongoose');

const proxyAccountSchema = new mongoose.Schema({
  proxy: {
    host: String,
    port: Number,
    username: String,
    password: String,
    protocol: String,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  emailPassword: String,
  active: {
    type: Boolean,
    default: true,
  },
  streak: {
    type: Boolean,
    default: true,
  },
  createdAtVN: {
    type: String,
    required: true,
  },
  updatedAtVN: {
    type: String,
    required: true,
  },
  complete: {
    type: Boolean,
    default: false,
  },
  proxyAlive: {
    type: Boolean,
    default: true,
  },
  // Mảng lưu các từ khóa đã search (mỗi phần tử là 1 string)
  searchedKeywords: {
    type: [String],
    default: [],
  },
});

module.exports = mongoose.model('ProxyAccount', proxyAccountSchema);
