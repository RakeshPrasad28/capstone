require("dotenv").config();

module.exports = {
  PORT: process.env.PORT || 3000,
  DATABASE_URL: process.env.DATABASE_URL || "file:./dev.db",
  JWT_SECRET: process.env.JWT_SECRET || "default_jwt_secret_capstone_2026",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  MAX_STEP_RETRIES: parseInt(process.env.MAX_STEP_RETRIES, 10) || 3,
  RETRY_DELAY_MS: parseInt(process.env.RETRY_DELAY_MS, 10) || 1000
};
