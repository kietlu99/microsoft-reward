// src/auth/login.js
const { delay, log } = require('../utils');
const {
  BING_URL,
  MS_LOGIN_BTN,
  EMAIL_INPUT,
  PASSWORD_INPUT,
  PRIMARY_BTN,
  SECONDARY_BTN,
} = require('../config');

/**
 * @param {import('puppeteer').Page} page
 * @param {string} email
 * @param {string} password
 */
module.exports = async function login(page, email, password) {
  await page.goto(BING_URL, { waitUntil: 'networkidle2' });
  await page.waitForSelector(MS_LOGIN_BTN, { timeout: 15000 });
  await page.click(MS_LOGIN_BTN);
  await page.waitForNavigation({ waitUntil: 'networkidle2' });
  log('On Microsoft login page');

  await page.waitForSelector(EMAIL_INPUT, { timeout: 10000 });
  await page.type(EMAIL_INPUT, email, { delay: 100 });
  await page.waitForSelector(PRIMARY_BTN, { timeout: 10000 });
  await page.click(PRIMARY_BTN);
  await page.waitForNavigation({ waitUntil: 'networkidle2' });

  await page.waitForSelector(PASSWORD_INPUT, { timeout: 10000 });
  await page.type(PASSWORD_INPUT, password, { delay: 100 });
  await page.waitForSelector(PRIMARY_BTN, { timeout: 10000 });
  await page.click(PRIMARY_BTN);

  // Handle "Stay signed in?"
  try {
    await page.waitForSelector(SECONDARY_BTN, { timeout: 5000 });
    await page.click(SECONDARY_BTN);
    log('Chose “No” to stay signed in');
  } catch {}

  await page.waitForNavigation({ waitUntil: 'networkidle2' });
  log('Logged in successfully');
};
