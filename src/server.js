const app = require("./app");
const { PORT } = require("./config/env");
const prisma = require("./config/database");
const scheduleManager = require("./modules/triggers/schedule.manager");

async function bootstrap() {
  try {
    await prisma.$connect();
    await scheduleManager.initializeSchedules();

    const server = app.listen(PORT, () => {
      console.log(`Flow workflow engine server is running on http://localhost:${PORT}`);
    });

    const shutdown = async () => {
      scheduleManager.stopAll();
      server.close(async () => {
        await prisma.$disconnect();
        process.exit(0);
      });
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

bootstrap();
