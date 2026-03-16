import { app, apiErrorHandler, initRedisCache, initStore, PORT } from "./services/serverCoreRuntime.js";
import apiRouter from "./routes/index.js";
import { initPaymentsRuntime } from "./controllers/paymentsController.js";
import { runMigrations } from "./db/migrations.js";

app.use(apiRouter);

export async function startServer() {
  await initStore();
  await runMigrations();
  await initRedisCache();
  initPaymentsRuntime();
  app.use(apiErrorHandler);
  app.listen(PORT, () => {
    console.log(`Hulkcore backend running on http://localhost:${PORT}`);
  });
}

export { app };
