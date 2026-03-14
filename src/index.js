import { app, apiErrorHandler, initRedisCache, initStore, PORT } from "./services/serverCoreRuntime.js";
import apiRouter from "./routes/index.js";
import { initPaymentsRuntime } from "./controllers/paymentsController.js";

app.use(apiRouter);

export async function startServer() {
  await initStore();
  await initRedisCache();
  initPaymentsRuntime();
  app.use(apiErrorHandler);
  app.listen(PORT, () => {
    console.log(`Hulkcore backend running on http://localhost:${PORT}`);
  });
}

export { app };
