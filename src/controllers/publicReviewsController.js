import { Router } from "express";
import * as core from "./index.js";

const app = Router();
Object.assign(globalThis, core);

app.get(["/api/public/reviews/highlighted", "/public/reviews/highlighted"], async (_req, res, next) => {
  try {
    const reviews = await fetchHighlightedReviews();
    res.json({ reviews });
  } catch (error) {
    next(error);
  }
});

export default app;
