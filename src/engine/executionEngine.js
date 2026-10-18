const prisma = require("../config/database");
const { RunStatus, StepStatus, WorkflowStatus } = require("../constants/status");
const ExecutionContext = require("./context");
const nodeRegistry = require("./nodeRegistry");
const { MAX_STEP_RETRIES, RETRY_DELAY_MS } = require("../config/env");

class ExecutionEngine {
  async executeWorkflow(workflowId, triggerSource = "MANUAL", triggerPayload = {}, existingRunId = null) {
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId }
    });

    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    if (workflow.status !== WorkflowStatus.PUBLISHED) {
      throw new Error(`Cannot execute workflow in status ${workflow.status}. Only PUBLISHED workflows can be executed.`);
    }

    let run;
    if (existingRunId) {
      run = await prisma.workflowRun.findUnique({
        where: { id: existingRunId }
      });
      if (!run) {
        throw new Error(`Run ${existingRunId} not found`);
      }
      run = await prisma.workflowRun.update({
        where: { id: existingRunId },
        data: {
          status: RunStatus.RUNNING,
          startedAt: new Date()
        }
      });
    } else {
      run = await prisma.workflowRun.create({
        data: {
          workflowId: workflow.id,
          status: RunStatus.RUNNING,
          triggerSource,
          triggerPayload: JSON.stringify(triggerPayload),
          startedAt: new Date()
        }
      });
    }

    const context = new ExecutionContext({
      trigger: triggerPayload
    });

    const runStartTime = Date.now();
    let nodesList = [];

    try {
      nodesList = typeof workflow.nodes === "string" ? JSON.parse(workflow.nodes) : workflow.nodes;
    } catch (err) {
      await this.markRunFailed(run.id, `Invalid workflow nodes format: ${err.message}`, Date.now() - runStartTime);
      return { runId: run.id, status: RunStatus.FAILED, error: err.message };
    }

    if (!Array.isArray(nodesList) || nodesList.length === 0) {
      await prisma.workflowRun.update({
        where: { id: run.id },
        data: {
          status: RunStatus.COMPLETED,
          completedAt: new Date(),
          durationMs: Date.now() - runStartTime
        }
      });
      return { runId: run.id, status: RunStatus.COMPLETED, durationMs: Date.now() - runStartTime };
    }

    const nodeMap = new Map();
    for (const node of nodesList) {
      nodeMap.set(node.id, node);
    }

    let currentNodeId = nodesList[0].id;
    const visitedNodes = new Set();
    const maxExecutionSteps = 1000;
    let stepCount = 0;

    try {
      while (currentNodeId && stepCount < maxExecutionSteps) {
        stepCount++;
        const node = nodeMap.get(currentNodeId);

        if (!node) {
          break;
        }

        const stepResult = await this.executeStepWithRetry(run.id, node, context);

        if (stepResult.status === StepStatus.FAILED) {
          await this.markRunFailed(run.id, stepResult.error, Date.now() - runStartTime);
          return { runId: run.id, status: RunStatus.FAILED, error: stepResult.error };
        }

        context.setStepOutput(node.id, stepResult.output);

        if (node.type === "CONDITION" && stepResult.output) {
          if (stepResult.output.outcome) {
            currentNodeId = node.trueBranchId || node.config?.trueBranch || node.nextId;
          } else {
            currentNodeId = node.falseBranchId || node.config?.falseBranch || node.elseBranchId || null;
          }
        } else {
          currentNodeId = node.nextId || null;
        }

        if (!currentNodeId && node.type !== "CONDITION") {
          const currentIndex = nodesList.findIndex(n => n.id === node.id);
          if (currentIndex !== -1 && currentIndex + 1 < nodesList.length) {
            currentNodeId = nodesList[currentIndex + 1].id;
          }
        }
      }

      const totalDuration = Date.now() - runStartTime;
      await prisma.workflowRun.update({
        where: { id: run.id },
        data: {
          status: RunStatus.COMPLETED,
          completedAt: new Date(),
          durationMs: totalDuration
        }
      });

      return {
        runId: run.id,
        status: RunStatus.COMPLETED,
        durationMs: totalDuration,
        outputs: context.getSnapshot().steps
      };
    } catch (err) {
      await this.markRunFailed(run.id, err.message, Date.now() - runStartTime);
      return { runId: run.id, status: RunStatus.FAILED, error: err.message };
    }
  }

  async executeStepWithRetry(runId, node, context) {
    const executor = nodeRegistry.get(node.type);
    const maxRetries = node.retries !== undefined ? Number(node.retries) : MAX_STEP_RETRIES;
    let attempt = 0;
    let lastError = null;

    const stepStartTime = Date.now();
    const inputSnapshot = JSON.stringify({
      config: node.config,
      contextSnapshot: context.getSnapshot()
    });

    while (attempt <= maxRetries) {
      try {
        const output = await executor.execute(node.config || {}, context);
        const durationMs = Date.now() - stepStartTime;

        await prisma.stepLog.create({
          data: {
            runId,
            nodeId: node.id,
            nodeType: node.type,
            nodeName: node.name || node.id,
            status: StepStatus.SUCCESS,
            inputData: inputSnapshot,
            outputData: JSON.stringify(output),
            retryCount: attempt,
            durationMs
          }
        });

        return { status: StepStatus.SUCCESS, output };
      } catch (err) {
        lastError = err;
        attempt++;

        if (attempt <= maxRetries) {
          const backoff = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
          await new Promise(r => setTimeout(r, backoff));
        }
      }
    }

    const durationMs = Date.now() - stepStartTime;
    const errorMessage = lastError?.message || "Step execution failed";

    await prisma.stepLog.create({
      data: {
        runId,
        nodeId: node.id,
        nodeType: node.type,
        nodeName: node.name || node.id,
        status: StepStatus.FAILED,
        inputData: inputSnapshot,
        outputData: JSON.stringify(lastError?.details || null),
        errorMessage,
        retryCount: attempt - 1,
        durationMs
      }
    });

    return { status: StepStatus.FAILED, error: errorMessage };
  }

  async markRunFailed(runId, errorMessage, durationMs) {
    await prisma.workflowRun.update({
      where: { id: runId },
      data: {
        status: RunStatus.FAILED,
        error: errorMessage,
        completedAt: new Date(),
        durationMs
      }
    });
  }
}

const executionEngine = new ExecutionEngine();

module.exports = executionEngine;
