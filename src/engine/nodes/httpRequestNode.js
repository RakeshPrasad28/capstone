const axios = require("axios");
const BaseNode = require("./baseNode");
const { NodeType } = require("../../constants/status");
const { interpolateDeep } = require("../../utils/expressionEvaluator");

class HttpRequestNode extends BaseNode {
  constructor() {
    super(NodeType.HTTP_REQUEST);
  }

  async execute(config, context) {
    const rawUrl = config.url;
    if (!rawUrl) {
      throw new Error("HTTP Request node requires a URL");
    }

    const contextSnapshot = context.getSnapshot();
    const url = interpolateDeep(rawUrl, contextSnapshot);
    const method = (config.method || "GET").toUpperCase();
    const headers = interpolateDeep(config.headers || {}, contextSnapshot);
    const params = interpolateDeep(config.params || {}, contextSnapshot);
    const timeout = config.timeout || 15000;

    let data;
    if (["POST", "PUT", "PATCH"].includes(method)) {
      data = interpolateDeep(config.body || {}, contextSnapshot);
    }

    const response = await axios({
      method,
      url,
      headers,
      params,
      data,
      timeout,
      validateStatus: () => true
    });

    const isSuccess = response.status >= 200 && response.status < 400;

    const result = {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data: response.data
    };

    if (!isSuccess && config.failOnHttpError !== false) {
      const error = new Error(`HTTP Request failed with status ${response.status}`);
      error.details = result;
      throw error;
    }

    return result;
  }
}

module.exports = HttpRequestNode;
