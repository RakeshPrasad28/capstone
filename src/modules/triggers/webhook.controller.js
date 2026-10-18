const prisma = require("../../config/database");
const executionEngine = require("../../engine/executionEngine");
const { WorkflowStatus, TriggerType, RunStatus } = require("../../constants/status");

class WebhookController {
  async handleWebhook(req, res, next) {
    try {
      const { workflowId } = req.params;
      const secretHeader = req.headers["x-webhook-secret"] || req.query.secret;

      const workflow = await prisma.workflow.findUnique({
        where: { id: workflowId }
      });

      if (!workflow) {
        return res.status(404).json({
          success: false,
          message: "Workflow not found"
        });
      }

      if (workflow.status !== WorkflowStatus.PUBLISHED) {
        return res.status(400).json({
          success: false,
          message: `Workflow cannot be triggered via webhook because it is in ${workflow.status} state. Only PUBLISHED workflows can execute.`
        });
      }

      if (workflow.triggerType !== TriggerType.WEBHOOK) {
        return res.status(400).json({
          success: false,
          message: `Workflow triggerType is ${workflow.triggerType}, not WEBHOOK.`
        });
      }

      let config = {};
      try {
        config = typeof workflow.triggerConfig === "string" ? JSON.parse(workflow.triggerConfig) : workflow.triggerConfig;
      } catch (e) {
        config = {};
      }

      if (config.secretKey) {
        if (!secretHeader || secretHeader !== config.secretKey) {
          return res.status(401).json({
            success: false,
            message: "Unauthorized: Invalid or missing webhook secret key"
          });
        }
      }

      const triggerPayload = {
        headers: req.headers,
        query: req.query,
        body: req.body,
        receivedAt: new Date().toISOString()
      };

      const initialRun = await prisma.workflowRun.create({
        data: {
          workflowId: workflow.id,
          status: RunStatus.PENDING,
          triggerSource: TriggerType.WEBHOOK,
          triggerPayload: JSON.stringify(triggerPayload)
        }
      });

      const waitSync = req.headers["x-wait-execution"] === "true";

      if (waitSync) {
        const executionResult = await executionEngine.executeWorkflow(
          workflow.id,
          TriggerType.WEBHOOK,
          triggerPayload,
          initialRun.id
        );

        return res.status(200).json({
          success: true,
          message: "Workflow executed via webhook",
          data: executionResult
        });
      }

      setImmediate(() => {
        executionEngine.executeWorkflow(
          workflow.id,
          TriggerType.WEBHOOK,
          triggerPayload,
          initialRun.id
        ).catch(err => {
          console.error(`Background webhook execution error for workflow ${workflow.id}:`, err.message);
        });
      });

      return res.status(202).json({
        success: true,
        message: "Webhook accepted and workflow execution queued",
        data: {
          runId: initialRun.id,
          workflowId: workflow.id,
          status: RunStatus.PENDING
        }
      });
    } catch (err) {
      next(err);
    }
  }
}

const webhookController = new WebhookController();

module.exports = webhookController;
