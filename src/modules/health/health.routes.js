const express = require("express");
const router = express.Router();
const healthController = require("./health.controller");

router.get("/", (req, res) => healthController.getHealth(req, res));

module.exports = router;
