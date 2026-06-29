import { Router } from "express";
import * as core from "./index.js";

const app = Router();

app.get("/api/user/wishlist", async (req, res, next) => {
  try {
    const authSession = await core.requireAuthenticatedSession(req, res);
    if (!authSession) return;
    const items = await core.getWishlistByUserId(authSession.user.id);
    return res.json({ items });
  } catch (error) {
    next(error);
  }
});

app.post("/api/user/wishlist", async (req, res, next) => {
  try {
    const authSession = await core.requireAuthenticatedSession(req, res);
    if (!authSession) return;

    const { productId } = req.body;
    if (!productId || typeof productId !== "string") {
      return res.status(400).json({ message: "Product ID is required" });
    }

    const item = await core.addWishlistItem(authSession.user.id, productId);
    return res.json({ item });
  } catch (error) {
    if (error.message === "Product not found") {
      return res.status(404).json({ message: "Product not found" });
    }
    next(error);
  }
});

app.delete("/api/user/wishlist/:productId", async (req, res, next) => {
  try {
    const authSession = await core.requireAuthenticatedSession(req, res);
    if (!authSession) return;

    const { productId } = req.params;
    await core.removeWishlistItem(authSession.user.id, productId);
    return res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default app;
