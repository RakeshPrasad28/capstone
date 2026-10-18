const express = require("express");
const router = express.Router();
const runController = require("./run.controller");
const { authenticateToken } = require("../../middlewares/auth.middleware");

router.use(authenticateToken);

router.get("/recent", (req, res, next) => runController.getRecentRuns(req, res, next));
router.get("/workflows/:workflowId", (req, res, next) => runController.getWorkflowRuns(req, res, next));
router.get("/:runId", (req, res, next) => runController.getRunById(req, res, next));

module.exports = router;
