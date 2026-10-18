const workflowService = require("./workflow.service");

class WorkflowController {
  async create(req, res, next) {
    try {
      const result = await workflowService.createWorkflow(req.user.id, req.body);
      return res.status(201).json({
        success: true,
        message: "Workflow created successfully in DRAFT state",
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  async getAll(req, res, next) {
    try {
      const result = await workflowService.getWorkflows(req.user.id);
      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  async getOne(req, res, next) {
    try {
      const result = await workflowService.getWorkflowById(req.user.id, req.params.id);
      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const result = await workflowService.updateWorkflow(req.user.id, req.params.id, req.body);
      return res.status(200).json({
        success: true,
        message: "Workflow updated successfully",
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      const result = await workflowService.deleteWorkflow(req.user.id, req.params.id);
      return res.status(200).json({
        success: true,
        message: "Workflow deleted successfully",
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  async publish(req, res, next) {
    try {
      const result = await workflowService.publishWorkflow(req.user.id, req.params.id);
      return res.status(200).json({
        success: true,
        message: "Workflow published and frozen for execution",
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  async draft(req, res, next) {
    try {
      const result = await workflowService.revertToDraft(req.user.id, req.params.id);
      return res.status(200).json({
        success: true,
        message: "Workflow reverted to DRAFT state for editing",
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  async pause(req, res, next) {
    try {
      const result = await workflowService.pauseWorkflow(req.user.id, req.params.id);
      return res.status(200).json({
        success: true,
        message: "Workflow paused",
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  async resume(req, res, next) {
    try {
      const result = await workflowService.resumeWorkflow(req.user.id, req.params.id);
      return res.status(200).json({
        success: true,
        message: "Workflow resumed",
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  async reschedule(req, res, next) {
    try {
      const result = await workflowService.rescheduleWorkflow(req.user.id, req.params.id, req.body.cron);
      return res.status(200).json({
        success: true,
        message: "Workflow rescheduled successfully",
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  async start(req, res, next) {
    try {
      const result = await workflowService.startWorkflow(req.user.id, req.params.id, req.body.payload || {});
      return res.status(200).json({
        success: true,
        message: "Workflow execution completed",
        data: result
      });
    } catch (err) {
      next(err);
    }
  }
}

const workflowController = new WorkflowController();

module.exports = workflowController;
