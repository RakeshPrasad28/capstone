const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config/env");
const prisma = require("../config/database");

async function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access token missing or invalid"
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, name: true }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found or deactivated"
      });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(403).json({
      success: false,
      message: "Token is invalid or expired"
    });
  }
}

module.exports = {
  authenticateToken
};
