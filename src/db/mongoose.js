// src/db/mongoose.js
const mongoose = require('mongoose');
const { MONGO_URI } = require('../config');

mongoose.connect(MONGO_URI);

module.exports = mongoose;
