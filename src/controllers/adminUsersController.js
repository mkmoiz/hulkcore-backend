import { Router } from "express";
import * as core from "./index.js";

const app = Router();
Object.assign(globalThis, core);

app.get(["/api/admin/users", "/admin/users"], core.requireAdminAccess, async (req, res, next) => {
  try {
    const q = core.cleanText(req.query?.q);
    const parsedLimit = core.toNonNegativeInt(req.query?.limit, 50);
    const parsedOffset = core.toNonNegativeInt(req.query?.offset, 0);
    const limit = Math.max(1, Math.min(parsedLimit ?? 50, 200));
    const offset = Math.max(0, parsedOffset ?? 0);

    const payload = await core.getUsersForAdmin({
      searchQuery: q,
      limit,
      offset,
    });
    
    return res.json(payload);
  } catch (error) {
    next(error);
  }
});

export default app;
