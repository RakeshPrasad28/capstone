const prisma = require("../../config/database");

class RunService {
  async getRunsForWorkflow(userId, workflowId, { page = 1, limit = 20, status } = {}) {
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId }
    });

    if (!workflow) {
      const error = new Error("Workflow not found");
      error.statusCode = 404;
      throw error;
    }

    if (workflow.userId !== userId) {
      const error = new Error("Unauthorized to access runs for this workflow");
      error.statusCode = 403;
      throw error;
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const whereClause = {
      workflowId,
      ...(status ? { status } : {})
    };

    const [total, runs] = await Promise.all([
      prisma.workflowRun.count({ where: whereClause }),
      prisma.workflowRun.findMany({
        where: whereClause,
        orderBy: { startedAt: "desc" },
        skip,
        take: limitNum,
        include: {
          _count: {
            select: { stepLogs: true }
          }
        }
      })
    ]);

    return {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      runs: runs.map(r => this.formatRunSummary(r))
    };
  }

  async getRunById(userId, runId) {
    const run = await prisma.workflowRun.findUnique({
      where: { id: runId },
      include: {
        workflow: {
          select: {
            id: true,
            name: true,
            userId: true
          }
        },
        stepLogs: {
          orderBy: { startedAt: "asc" }
        }
      }
    });

    if (!run) {
      const error = new Error("Run not found");
      error.statusCode = 404;
      throw error;
    }

    if (run.workflow.userId !== userId) {
      const error = new Error("Unauthorized to access this run");
      error.statusCode = 403;
      throw error;
    }

    return this.formatRunDetails(run);
  }

  async getRecentRuns(userId, limit = 10) {
    const runs = await prisma.workflowRun.findMany({
      where: {
        workflow: {
          userId
        }
      },
      orderBy: { startedAt: "desc" },
      take: Math.min(50, Math.max(1, parseInt(limit, 10))),
      include: {
        workflow: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    return runs.map(r => this.formatRunSummary(r));
  }

  formatRunSummary(run) {
    return {
      id: run.id,
      workflowId: run.workflowId,
      workflowName: run.workflow?.name,
      status: run.status,
      triggerSource: run.triggerSource,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      durationMs: run.durationMs,
      error: run.error,
      stepCount: run._count?.stepLogs ?? (run.stepLogs ? run.stepLogs.length : 0)
    };
  }

  formatRunDetails(run) {
    return {
      id: run.id,
      workflowId: run.workflowId,
      workflowName: run.workflow?.name,
      status: run.status,
      triggerSource: run.triggerSource,
      triggerPayload: typeof run.triggerPayload === "string" ? JSON.parse(run.triggerPayload) : run.triggerPayload,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      durationMs: run.durationMs,
      error: run.error,
      stepLogs: run.stepLogs.map(log => ({
        id: log.id,
        nodeId: log.nodeId,
        nodeType: log.nodeType,
        nodeName: log.nodeName,
        status: log.status,
        inputData: typeof log.inputData === "string" ? JSON.parse(log.inputData) : log.inputData,
        outputData: typeof log.outputData === "string" ? JSON.parse(log.outputData) : log.outputData,
        errorMessage: log.errorMessage,
        retryCount: log.retryCount,
        startedAt: log.startedAt,
        durationMs: log.durationMs
      }))
    };
  }
}

const runService = new RunService();

module.exports = runService;
