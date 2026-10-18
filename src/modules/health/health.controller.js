const prisma = require("../../config/database");
const scheduleManager = require("../triggers/schedule.manager");
const nodeRegistry = require("../../engine/nodeRegistry");

class HealthController {
  async getHealth(req, res) {
    const startTime = Date.now();
    let dbStatus = "HEALTHY";
    let dbLatencyMs = 0;

    try {
      await prisma.$queryRaw`SELECT 1`;
      dbLatencyMs = Date.now() - startTime;
    } catch (err) {
      dbStatus = "UNHEALTHY";
    }

    const memory = process.memoryUsage();

    return res.status(dbStatus === "HEALTHY" ? 200 : 503).json({
      status: dbStatus === "HEALTHY" ? "UP" : "DEGRADED",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs
      },
      scheduler: {
        activeCronJobs: scheduleManager.getActiveCount()
      },
      engine: {
        supportedNodes: nodeRegistry.listSupportedTypes()
      },
      memory: {
        rssMb: Math.round(memory.rss / 1024 / 1024),
        heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(memory.heapTotal / 1024 / 1024)
      }
    });
  }
}

const healthController = new HealthController();

module.exports = healthController;
