const { z } = require("zod");
const { TriggerType, NodeType } = require("../../constants/status");

const nodeSchema = z.object({
  id: z.string().min(1),
  type: z.nativeEnum(NodeType),
  name: z.string().optional(),
  config: z.record(z.any()).default({}),
  nextId: z.string().nullable().optional(),
  trueBranchId: z.string().nullable().optional(),
  falseBranchId: z.string().nullable().optional(),
  retries: z.number().int().min(0).max(5).optional()
});

const createWorkflowSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  triggerType: z.nativeEnum(TriggerType).default(TriggerType.MANUAL),
  triggerConfig: z.record(z.any()).default({}),
  nodes: z.array(nodeSchema).default([])
});

const updateWorkflowSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  triggerType: z.nativeEnum(TriggerType).optional(),
  triggerConfig: z.record(z.any()).optional(),
  nodes: z.array(nodeSchema).optional()
});

const rescheduleSchema = z.object({
  cron: z.string().min(1)
});

const manualStartSchema = z.object({
  payload: z.record(z.any()).optional()
}).optional().default({});

module.exports = {
  createWorkflowSchema,
  updateWorkflowSchema,
  rescheduleSchema,
  manualStartSchema
};
