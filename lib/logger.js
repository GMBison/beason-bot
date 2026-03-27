"use strict";

function log(level, message, meta = {}) {
  const entry = {
    level,
    message,
    ...meta,
    ts: new Date().toISOString(),
  };
  console.log(JSON.stringify(entry));
}

module.exports = {
  info(message, meta) {
    log("info", message, meta);
  },
  warn(message, meta) {
    log("warn", message, meta);
  },
  error(message, meta) {
    log("error", message, meta);
  },
};
