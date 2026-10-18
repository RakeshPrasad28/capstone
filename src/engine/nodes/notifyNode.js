const axios = require("axios");
const BaseNode = require("./baseNode");
const { NodeType } = require("../../constants/status");
const { interpolateDeep } = require("../../utils/expressionEvaluator");

class NotifyNode extends BaseNode {
  constructor() {
    super(NodeType.NOTIFY);
  }

  async execute(config, context) {
    const contextSnapshot = context.getSnapshot();
    const channel = (config.channel || "slack").toLowerCase();
    const recipient = interpolateDeep(config.recipient || "", contextSnapshot);
    const subject = interpolateDeep(config.subject || "Workflow Notification", contextSnapshot);
    const message = interpolateDeep(config.message || "", contextSnapshot);
    const webhookUrl = interpolateDeep(config.webhookUrl || "", contextSnapshot);

    if (channel === "slack" && webhookUrl) {
      try {
        const payload = {
          text: `*${subject}*\n${message}`
        };
        const response = await axios.post(webhookUrl, payload, { timeout: 10000 });
        return {
          channel: "slack",
          sent: true,
          status: response.status,
          messagePreview: message
        };
      } catch (err) {
        if (config.allowFailure) {
          return {
            channel: "slack",
            sent: false,
            error: err.message
          };
        }
        throw new Error(`Slack notification failed: ${err.message}`);
      }
    }

    return {
      channel,
      recipient,
      subject,
      message,
      sent: true,
      deliveredAt: new Date().toISOString()
    };
  }
}

module.exports = NotifyNode;
