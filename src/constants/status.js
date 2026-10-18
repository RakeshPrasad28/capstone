const WorkflowStatus = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  PAUSED: "PAUSED"
};

const RunStatus = {
  PENDING: "PENDING",
  RUNNING: "RUNNING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  PAUSED: "PAUSED"
};

const StepStatus = {
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
  SKIPPED: "SKIPPED",
  RETRYING: "RETRYING"
};

const TriggerType = {
  MANUAL: "MANUAL",
  WEBHOOK: "WEBHOOK",
  SCHEDULE: "SCHEDULE"
};

const NodeType = {
  HTTP_REQUEST: "HTTP_REQUEST",
  CONDITION: "CONDITION",
  DELAY: "DELAY",
  NOTIFY: "NOTIFY"
};

module.exports = {
  WorkflowStatus,
  RunStatus,
  StepStatus,
  TriggerType,
  NodeType
};
