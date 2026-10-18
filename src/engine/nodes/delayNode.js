const BaseNode = require("./baseNode");
const { NodeType } = require("../../constants/status");

class DelayNode extends BaseNode {
  constructor() {
    super(NodeType.DELAY);
  }

  async execute(config, context) {
    let seconds = Number(config.seconds);
    if (isNaN(seconds) || seconds < 0) {
      seconds = 1;
    }

    const waitMs = Math.min(seconds * 1000, 300000);

    await new Promise(resolve => setTimeout(resolve, waitMs));

    return {
      delayedSeconds: seconds,
      delayedMs: waitMs,
      completedAt: new Date().toISOString()
    };
  }
}

module.exports = DelayNode;
