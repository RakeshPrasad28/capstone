const express = require("express");
const router = express.Router();
const webhookController = require("./webhook.controller");
const { triggerLimiter } = require("../../middlewares/rateLimiter.middleware");

router.post("/:workflowId", triggerLimiter, (req, res, next) => webhookController.handleWebhook(req, res, next));

module.exports = router;
