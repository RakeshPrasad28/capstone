function validateBody(schema) {
  return (req, res, next) => {
    try {
      const parsed = schema.parse(req.body);
      req.body = parsed;
      next();
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: err.errors ? err.errors.map(e => ({ field: e.path.join("."), message: e.message })) : err.message
      });
    }
  };
}

module.exports = {
  validateBody
};
