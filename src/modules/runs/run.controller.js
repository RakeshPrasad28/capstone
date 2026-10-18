const runService = require("./run.service");

class RunController {
  async getWorkflowRuns(req, res, next) {
    try {
      const { workflowId } = req.params;
      const { page, limit, status } = req.query;
      const result = await runService.getRunsForWorkflow(req.user.id, workflowId, { page, limit, status });
      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  async getRunById(req, res, next) {
    try {
      const { runId } = req.params;
      const result = await runService.getRunById(req.user.id, runId);
      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  async getRecentRuns(req, res, next) {
    try {
      const { limit } = req.query;
      const result = await runService.getRecentRuns(req.user.id, limit);
      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }
}

const runController = new RunController();

module.exports = runController;
