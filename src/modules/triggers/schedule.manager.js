const cron = require("node-cron");
const prisma = require("../../config/database");
const executionEngine = require("../../engine/executionEngine");
const { WorkflowStatus, TriggerType } = require("../../constants/status");

class ScheduleManager {
  constructor() {
    this.jobs = new Map();
  }

  async initializeSchedules() {
    this.stopAll();

    const workflows = await prisma.workflow.findMany({
      where: {
        status: WorkflowStatus.PUBLISHED,
        triggerType: TriggerType.SCHEDULE
      }
    });

    for (const workflow of workflows) {
      this.registerWorkflow(workflow);
    }
  }

  registerWorkflow(workflow) {
    if (this.jobs.has(workflow.id)) {
      this.unregisterWorkflow(workflow.id);
    }

    let config = {};
    try {
      config = typeof workflow.triggerConfig === "string" ? JSON.parse(workflow.triggerConfig) : workflow.triggerConfig;
    } catch (err) {
      return false;
    }

    const cronExpression = config.cron;
    if (!cronExpression || !cron.validate(cronExpression)) {
      return false;
    }

    const task = cron.schedule(cronExpression, async () => {
      try {
        await executionEngine.executeWorkflow(
          workflow.id,
          TriggerType.SCHEDULE,
          { scheduledTime: new Date().toISOString() }
        );
      } catch (err) {
        console.error(`Scheduled execution error for workflow ${workflow.id}:`, err.message);
      }
    });

    this.jobs.set(workflow.id, {
      task,
      cronExpression,
      registeredAt: new Date()
    });

    return true;
  }

  unregisterWorkflow(workflowId) {
    const job = this.jobs.get(workflowId);
    if (job) {
      job.task.stop();
      this.jobs.delete(workflowId);
      return true;
    }
    return false;
  }

  rescheduleWorkflow(workflow) {
    this.unregisterWorkflow(workflow.id);
    if (workflow.status === WorkflowStatus.PUBLISHED && workflow.triggerType === TriggerType.SCHEDULE) {
      return this.registerWorkflow(workflow);
    }
    return false;
  }

  stopAll() {
    for (const [id, job] of this.jobs.entries()) {
      job.task.stop();
    }
    this.jobs.clear();
  }

  getActiveCount() {
    return this.jobs.size;
  }

  listActiveJobs() {
    const list = [];
    for (const [workflowId, info] of this.jobs.entries()) {
      list.push({
        workflowId,
        cronExpression: info.cronExpression,
        registeredAt: info.registeredAt
      });
    }
    return list;
  }
}

const scheduleManager = new ScheduleManager();

module.exports = scheduleManager;
