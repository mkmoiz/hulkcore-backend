import { Router } from "express";
import * as core from "./index.js";

const app = Router();
Object.assign(globalThis, core);

app.get(["/api/admin/reviews", "/admin/reviews"], requireAdminAccess, async (req, res, next) => {
  try {
    const filters = {
      productId: req.query.productId,
    };
    if (req.query.isApproved !== undefined) {
      filters.isApproved = req.query.isApproved === "true" || req.query.isApproved === "1";
    }
    const reviews = await fetchAllReviews(filters);
    res.json(reviews);
  } catch (error) {
    next(error);
  }
});

app.put(["/api/admin/reviews/:id/approve", "/admin/reviews/:id/approve"], requireAdminAccess, async (req, res, next) => {
  try {
    const review = await approveReview(req.params.id);
    res.json(review);
  } catch (error) {
    next(error);
  }
});

app.put(["/api/admin/reviews/:id/reject", "/admin/reviews/:id/reject"], requireAdminAccess, async (req, res, next) => {
  try {
    const review = await rejectReview(req.params.id);
    res.json(review);
  } catch (error) {
    next(error);
  }
});

app.delete(["/api/admin/reviews/:id", "/admin/reviews/:id"], requireAdminAccess, async (req, res, next) => {
  try {
    const success = await deleteReviewById(req.params.id, req.query.productId);
    if (!success) {
      return res.status(404).json({ message: "Review not found" });
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default app;
