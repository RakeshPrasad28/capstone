const express = require("express");
const router = express.Router();
const authController = require("./auth.controller");
const { validateBody } = require("../../middlewares/validator.middleware");
const { registerSchema, loginSchema } = require("./auth.validation");
const { authenticateToken } = require("../../middlewares/auth.middleware");

router.post("/register", validateBody(registerSchema), (req, res, next) => authController.register(req, res, next));
router.post("/login", validateBody(loginSchema), (req, res, next) => authController.login(req, res, next));
router.get("/me", authenticateToken, (req, res, next) => authController.getMe(req, res, next));

module.exports = router;
