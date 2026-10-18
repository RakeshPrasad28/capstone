class ExecutionContext {
  constructor(initialData = {}) {
    this.trigger = initialData.trigger || {};
    this.steps = initialData.steps || {};
    this.variables = initialData.variables || {};
  }

  setStepOutput(nodeId, output) {
    this.steps[nodeId] = output;
  }

  getStepOutput(nodeId) {
    return this.steps[nodeId];
  }

  getSnapshot() {
    return {
      trigger: this.trigger,
      steps: this.steps,
      variables: this.variables
    };
  }
}

module.exports = ExecutionContext;
