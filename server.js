import { app, startServer } from "./src/index.js";

if (process.env.NODE_ENV !== "test" && process.env.VITEST !== "true") {
  startServer().catch((error) => {
    console.error("Failed to start Hulkcore backend:", error);
    process.exit(1);
  });
}

export { app, startServer };
