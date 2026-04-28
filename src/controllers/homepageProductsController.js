import { Router } from "express";
import * as core from "./index.js";

const app = Router();
Object.assign(globalThis, core);

app.get(["/api/public/homepage-products", "/public/homepage-products"], async (_req, res, next) => {
  try {
    const payload = await getHomepageProducts(false);
    return res.json({
      section: payload.section,
      items: payload.section.isActive
        ? payload.items.filter((entry) => entry.product?.isActive)
        : [],
    });
  } catch (error) {
    next(error);
  }
});

app.get(["/api/admin/homepage-products", "/admin/homepage-products"], requireAdminAccess, async (_req, res, next) => {
  try {
    const payload = await getHomepageProducts(true);
    return res.json(payload);
  } catch (error) {
    next(error);
  }
});

app.put(["/api/admin/homepage-products", "/admin/homepage-products"], requireAdminAccess, async (req, res, next) => {
  try {
    const validation = await validateHomepageProductsPayload(req.body);
    if (validation.error) {
      return res.status(400).json({ message: validation.error });
    }

    const payload = await replaceHomepageProducts(validation.value);
    return res.json(payload);
  } catch (error) {
    next(error);
  }
});

export default app;
