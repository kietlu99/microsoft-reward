module.exports = {
  delay: (ms) => new Promise((res) => setTimeout(res, ms)),
  log: (...args) => console.log('[LOG]', ...args),
  error: (...args) => console.error('[ERROR]', ...args),
};
