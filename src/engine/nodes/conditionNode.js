const BaseNode = require("./baseNode");
const { NodeType } = require("../../constants/status");
const { getNestedValue, evaluateCondition, interpolateDeep } = require("../../utils/expressionEvaluator");

class ConditionNode extends BaseNode {
  constructor() {
    super(NodeType.CONDITION);
  }

  async execute(config, context) {
    const contextSnapshot = context.getSnapshot();
    const fieldPath = config.field;
    const operator = config.operator || "==";
    const expectedValue = interpolateDeep(config.value, contextSnapshot);

    const actualValue = fieldPath ? getNestedValue(contextSnapshot, fieldPath) : undefined;
    const outcome = evaluateCondition(operator, actualValue, expectedValue);

    return {
      field: fieldPath,
      operator,
      expectedValue,
      actualValue,
      outcome,
      nextBranch: outcome ? (config.trueBranch || null) : (config.falseBranch || null)
    };
  }
}

module.exports = ConditionNode;
