const express = require("express");
const router = express.Router();
const workflowController = require("./workflow.controller");
const { authenticateToken } = require("../../middlewares/auth.middleware");
const { validateBody } = require("../../middlewares/validator.middleware");
const {
  createWorkflowSchema,
  updateWorkflowSchema,
  rescheduleSchema,
  manualStartSchema
} = require("./workflow.validation");

router.use(authenticateToken);

router.post("/", validateBody(createWorkflowSchema), (req, res, next) => workflowController.create(req, res, next));
router.get("/", (req, res, next) => workflowController.getAll(req, res, next));
router.get("/:id", (req, res, next) => workflowController.getOne(req, res, next));
router.put("/:id", validateBody(updateWorkflowSchema), (req, res, next) => workflowController.update(req, res, next));
router.delete("/:id", (req, res, next) => workflowController.delete(req, res, next));

router.post("/:id/publish", (req, res, next) => workflowController.publish(req, res, next));
router.post("/:id/draft", (req, res, next) => workflowController.draft(req, res, next));
router.post("/:id/pause", (req, res, next) => workflowController.pause(req, res, next));
router.post("/:id/resume", (req, res, next) => workflowController.resume(req, res, next));
router.post("/:id/reschedule", validateBody(rescheduleSchema), (req, res, next) => workflowController.reschedule(req, res, next));
router.post("/:id/start", validateBody(manualStartSchema), (req, res, next) => workflowController.start(req, res, next));

module.exports = router;
