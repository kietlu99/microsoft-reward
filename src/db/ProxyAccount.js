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
  // Thêm trường 'complete' cho biết tài khoản đã hoàn thành hay chưa
  complete: {
    type: Boolean,
    default: false,
  },
  // Thêm trường 'proxyAlive' cho biết proxy còn hoạt động hay đã chết
  proxyAlive: {
    type: Boolean,
    default: true,
  },
});

module.exports = mongoose.model('ProxyAccount', proxyAccountSchema);
