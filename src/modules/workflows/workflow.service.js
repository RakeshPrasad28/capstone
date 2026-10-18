const prisma = require("../../config/database");
const { WorkflowStatus, TriggerType } = require("../../constants/status");
const scheduleManager = require("../triggers/schedule.manager");
const executionEngine = require("../../engine/executionEngine");

class WorkflowService {
  async createWorkflow(userId, data) {
    const { name, description, triggerType = TriggerType.MANUAL, triggerConfig = {}, nodes = [] } = data;

    const workflow = await prisma.workflow.create({
      data: {
        userId,
        name,
        description: description || null,
        status: WorkflowStatus.DRAFT,
        triggerType,
        triggerConfig: JSON.stringify(triggerConfig),
        nodes: JSON.stringify(nodes),
        version: 1
      }
    });

    return this.formatWorkflow(workflow);
  }

  async getWorkflows(userId) {
    const workflows = await prisma.workflow.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      include: {
        _count: {
          select: { runs: true }
        }
      }
    });

    return workflows.map(w => this.formatWorkflow(w));
  }

  async getWorkflowById(userId, workflowId) {
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
      include: {
        runs: {
          take: 5,
          orderBy: { startedAt: "desc" }
        }
      }
    });

    if (!workflow) {
      const error = new Error("Workflow not found");
      error.statusCode = 404;
      throw error;
    }

    if (workflow.userId !== userId) {
      const error = new Error("Unauthorized to access this workflow");
      error.statusCode = 403;
      throw error;
    }

    return this.formatWorkflow(workflow);
  }

  async updateWorkflow(userId, workflowId, data) {
    const workflow = await this.getWorkflowById(userId, workflowId);

    if (workflow.status === WorkflowStatus.PUBLISHED) {
      const error = new Error("Published workflows cannot be edited directly. Please revert to DRAFT first or create a new version.");
      error.statusCode = 400;
      throw error;
    }

    const updateData = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.triggerType !== undefined) updateData.triggerType = data.triggerType;
    if (data.triggerConfig !== undefined) updateData.triggerConfig = JSON.stringify(data.triggerConfig);
    if (data.nodes !== undefined) updateData.nodes = JSON.stringify(data.nodes);

    const updated = await prisma.workflow.update({
      where: { id: workflowId },
      data: updateData
    });

    return this.formatWorkflow(updated);
  }

  async deleteWorkflow(userId, workflowId) {
    await this.getWorkflowById(userId, workflowId);

    scheduleManager.unregisterWorkflow(workflowId);

    await prisma.workflow.delete({
      where: { id: workflowId }
    });

    return { id: workflowId, deleted: true };
  }

  async publishWorkflow(userId, workflowId) {
    const workflow = await this.getWorkflowById(userId, workflowId);

    const updated = await prisma.workflow.update({
      where: { id: workflowId },
      data: {
        status: WorkflowStatus.PUBLISHED,
        version: { increment: 1 }
      }
    });

    if (updated.triggerType === TriggerType.SCHEDULE) {
      scheduleManager.registerWorkflow(updated);
    }

    return this.formatWorkflow(updated);
  }

  async revertToDraft(userId, workflowId) {
    const workflow = await this.getWorkflowById(userId, workflowId);

    scheduleManager.unregisterWorkflow(workflowId);

    const updated = await prisma.workflow.update({
      where: { id: workflowId },
      data: {
        status: WorkflowStatus.DRAFT
      }
    });

    return this.formatWorkflow(updated);
  }

  async pauseWorkflow(userId, workflowId) {
    const workflow = await this.getWorkflowById(userId, workflowId);

    if (workflow.status !== WorkflowStatus.PUBLISHED) {
      const error = new Error(`Only PUBLISHED workflows can be paused. Current status is ${workflow.status}.`);
      error.statusCode = 400;
      throw error;
    }

    scheduleManager.unregisterWorkflow(workflowId);

    const updated = await prisma.workflow.update({
      where: { id: workflowId },
      data: {
        status: WorkflowStatus.PAUSED
      }
    });

    return this.formatWorkflow(updated);
  }

  async resumeWorkflow(userId, workflowId) {
    const workflow = await this.getWorkflowById(userId, workflowId);

    if (workflow.status !== WorkflowStatus.PAUSED) {
      const error = new Error(`Only PAUSED workflows can be resumed. Current status is ${workflow.status}.`);
      error.statusCode = 400;
      throw error;
    }

    const updated = await prisma.workflow.update({
      where: { id: workflowId },
      data: {
        status: WorkflowStatus.PUBLISHED
      }
    });

    if (updated.triggerType === TriggerType.SCHEDULE) {
      scheduleManager.registerWorkflow(updated);
    }

    return this.formatWorkflow(updated);
  }

  async rescheduleWorkflow(userId, workflowId, cronExpression) {
    const workflow = await this.getWorkflowById(userId, workflowId);

    let config = workflow.triggerConfig || {};
    config.cron = cronExpression;

    const updated = await prisma.workflow.update({
      where: { id: workflowId },
      data: {
        triggerType: TriggerType.SCHEDULE,
        triggerConfig: JSON.stringify(config)
      }
    });

    if (updated.status === WorkflowStatus.PUBLISHED) {
      scheduleManager.rescheduleWorkflow(updated);
    }

    return this.formatWorkflow(updated);
  }

  async startWorkflow(userId, workflowId, payload = {}) {
    const workflow = await this.getWorkflowById(userId, workflowId);

    if (workflow.status !== WorkflowStatus.PUBLISHED) {
      const error = new Error(`Cannot start workflow in status ${workflow.status}. Only PUBLISHED workflows can be started.`);
      error.statusCode = 400;
      throw error;
    }

    const executionResult = await executionEngine.executeWorkflow(
      workflowId,
      TriggerType.MANUAL,
      payload
    );

    return executionResult;
  }

  formatWorkflow(workflow) {
    return {
      ...workflow,
      triggerConfig: typeof workflow.triggerConfig === "string" ? JSON.parse(workflow.triggerConfig) : workflow.triggerConfig,
      nodes: typeof workflow.nodes === "string" ? JSON.parse(workflow.nodes) : workflow.nodes
    };
  }
}

const workflowService = new WorkflowService();

module.exports = workflowService;
