class BaseNode {
  constructor(type) {
    this.type = type;
  }

  async execute(config, context) {
    throw new Error(`Execute method not implemented for node type: ${this.type}`);
  }
}

module.exports = BaseNode;
