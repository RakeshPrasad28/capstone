function getNestedValue(obj, path) {
  if (!obj || !path) return undefined;
  const parts = path.split(".");
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }
  return current;
}

function interpolateString(template, context) {
  if (typeof template !== "string") return template;
  return template.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, expression) => {
    const value = getNestedValue(context, expression);
    return value !== undefined ? (typeof value === "object" ? JSON.stringify(value) : String(value)) : "";
  });
}

function interpolateDeep(value, context) {
  if (typeof value === "string") {
    return interpolateString(value, context);
  }
  if (Array.isArray(value)) {
    return value.map(item => interpolateDeep(item, context));
  }
  if (value !== null && typeof value === "object") {
    const resolved = {};
    for (const [key, val] of Object.entries(value)) {
      resolved[key] = interpolateDeep(val, context);
    }
    return resolved;
  }
  return value;
}

function evaluateCondition(operator, leftValue, rightValue) {
  switch (operator) {
    case "==":
    case "equals":
      return leftValue == rightValue;
    case "===":
      return leftValue === rightValue;
    case "!=":
    case "not_equals":
      return leftValue != rightValue;
    case "!==":
      return leftValue !== rightValue;
    case ">":
      return Number(leftValue) > Number(rightValue);
    case ">=":
      return Number(leftValue) >= Number(rightValue);
    case "<":
      return Number(leftValue) < Number(rightValue);
    case "<=":
      return Number(leftValue) <= Number(rightValue);
    case "contains":
      if (typeof leftValue === "string" || Array.isArray(leftValue)) {
        return leftValue.includes(rightValue);
      }
      return false;
    case "not_contains":
      if (typeof leftValue === "string" || Array.isArray(leftValue)) {
        return !leftValue.includes(rightValue);
      }
      return true;
    case "exists":
      return leftValue !== undefined && leftValue !== null && leftValue !== "";
    case "not_exists":
      return leftValue === undefined || leftValue === null || leftValue === "";
    default:
      return Boolean(leftValue);
  }
}

module.exports = {
  getNestedValue,
  interpolateString,
  interpolateDeep,
  evaluateCondition
};
