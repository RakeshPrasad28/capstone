const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const { apiLimiter } = require("./middlewares/rateLimiter.middleware");
const { errorHandler, notFoundHandler } = require("./middlewares/errorHandler.middleware");

const healthRoutes = require("./modules/health/health.routes");
const authRoutes = require("./modules/auth/auth.routes");
const workflowRoutes = require("./modules/workflows/workflow.routes");
const runRoutes = require("./modules/runs/run.routes");
const webhookRoutes = require("./modules/triggers/webhook.routes");

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.status(200).json({
    name: "Flow: Workflow Builder API",
    version: "1.0.0",
    status: "UP",
    endpoints: {
      health: "/api/v1/health",
      auth: "/api/v1/auth",
      workflows: "/api/v1/workflows",
      runs: "/api/v1/runs",
      webhooks: "/api/v1/triggers/webhook/:workflowId"
    }
  });
});

app.use("/api/v1/health", healthRoutes);
app.use("/api/v1/triggers/webhook", webhookRoutes);

app.use("/api/v1", apiLimiter);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/workflows", workflowRoutes);
app.use("/api/v1/runs", runRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
