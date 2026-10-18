const HttpRequestNode = require("./nodes/httpRequestNode");
const ConditionNode = require("./nodes/conditionNode");
const DelayNode = require("./nodes/delayNode");
const NotifyNode = require("./nodes/notifyNode");
const { NodeType } = require("../constants/status");

class NodeRegistry {
  constructor() {
    this.nodes = new Map();
    this.registerDefaults();
  }

  registerDefaults() {
    this.register(NodeType.HTTP_REQUEST, new HttpRequestNode());
    this.register(NodeType.CONDITION, new ConditionNode());
    this.register(NodeType.DELAY, new DelayNode());
    this.register(NodeType.NOTIFY, new NotifyNode());
  }

  register(type, executor) {
    this.nodes.set(type, executor);
  }

  get(type) {
    const executor = this.nodes.get(type);
    if (!executor) {
      throw new Error(`Unsupported node type: ${type}`);
    }
    return executor;
  }

  has(type) {
    return this.nodes.has(type);
  }

  listSupportedTypes() {
    return Array.from(this.nodes.keys());
  }
}

const nodeRegistry = new NodeRegistry();

module.exports = nodeRegistry;
