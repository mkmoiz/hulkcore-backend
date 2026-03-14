import { Router } from "express";
import * as core from "./index.js";

const app = Router();
Object.assign(globalThis, core);

app.get(["/api/admin/offer-products", "/admin/offer-products"], requireAdminAccess, async (_req, res, next) => {
  try {
    const offers = await getOfferProducts(true);
    return res.json({ items: offers });
  } catch (error) {
    next(error);
  }
});

app.put(["/api/admin/offer-products", "/admin/offer-products"], requireAdminAccess, async (req, res, next) => {
  try {
    const validation = await validateOfferProductsPayload(req.body);
    if (validation.error) {
      return res.status(400).json({ message: validation.error });
    }

    const offers = await replaceOfferProducts(validation.value);
    await invalidatePublicOffersCache();
    return res.json({ items: offers });
  } catch (error) {
    next(error);
  }
});

app.get(["/api/admin/combo-offers", "/admin/combo-offers"], requireAdminAccess, async (_req, res, next) => {
  try {
    const items = await getComboOffers(true);
    return res.json({ items });
  } catch (error) {
    next(error);
  }
});

app.post(["/api/admin/combo-offers", "/admin/combo-offers"], requireAdminAccess, async (req, res, next) => {
  try {
    const validation = await validateComboOfferPayload(req.body);
    if (validation.error) {
      return res.status(400).json({ message: validation.error });
    }

    const item = await createComboOffer(validation.value);
    await invalidatePublicComboOffersCache();
    return res.status(201).json(item);
  } catch (error) {
    next(error);
  }
});

app.put(["/api/admin/combo-offers/:id", "/admin/combo-offers/:id"], requireAdminAccess, async (req, res, next) => {
  try {
    const existing = await findComboOfferById(req.params.id, true);
    if (!existing) {
      return res.status(404).json({ message: "Combo offer not found." });
    }

    const validation = await validateComboOfferPayload(req.body, existing);
    if (validation.error) {
      return res.status(400).json({ message: validation.error });
    }

    const item = await updateComboOfferById(req.params.id, validation.value);
    if (!item) {
      return res.status(404).json({ message: "Combo offer not found." });
    }

    await invalidatePublicComboOffersCache();
    return res.json(item);
  } catch (error) {
    next(error);
  }
});

app.delete(["/api/admin/combo-offers/:id", "/admin/combo-offers/:id"], requireAdminAccess, async (req, res, next) => {
  try {
    const deleted = await deleteComboOfferById(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "Combo offer not found." });
    }

    await invalidatePublicComboOffersCache();
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.post(
  ["/api/admin/combo-offers/:id/duplicate", "/admin/combo-offers/:id/duplicate"],
  requireAdminAccess,
  async (req, res, next) => {
    try {
      const duplicated = await duplicateComboOfferById(req.params.id);
      if (!duplicated) {
        return res.status(404).json({ message: "Combo offer not found." });
      }

      await invalidatePublicComboOffersCache();
      return res.status(201).json(duplicated);
    } catch (error) {
      next(error);
    }
  },
);

app.get(["/api/admin/best-seller-products", "/admin/best-seller-products"], requireAdminAccess, async (_req, res, next) => {
  try {
    const items = await getBestSellerProducts(true);
    return res.json({ items });
  } catch (error) {
    next(error);
  }
});

app.put(["/api/admin/best-seller-products", "/admin/best-seller-products"], requireAdminAccess, async (req, res, next) => {
  try {
    const validation = await validateBestSellerProductsPayload(req.body);
    if (validation.error) {
      return res.status(400).json({ message: validation.error });
    }

    const items = await replaceBestSellerProducts(validation.value);
    await invalidatePublicBestSellersCache();
    return res.json({ items });
  } catch (error) {
    next(error);
  }
});

app.get(["/api/admin/lab-reports", "/admin/lab-reports"], requireAdminAccess, async (_req, res, next) => {
  try {
    const reports = await getLabReports(true);
    return res.json({ reports });
  } catch (error) {
    next(error);
  }
});

app.post(["/api/admin/lab-reports", "/admin/lab-reports"], requireAdminAccess, async (req, res, next) => {
  try {
    const validation = await validateLabReportPayload(req.body);
    if (validation.error) {
      return res.status(400).json({ message: validation.error });
    }

    const report = await createLabReport({
      id: createId("lbr"),
      ...validation.value,
    });

    await invalidatePublicLabReportsCache();
    return res.status(201).json(report);
  } catch (error) {
    next(error);
  }
});

app.put(["/api/admin/lab-reports/:id", "/admin/lab-reports/:id"], requireAdminAccess, async (req, res, next) => {
  try {
    const report = await findLabReportById(req.params.id);
    if (!report) {
      return res.status(404).json({ message: "Lab report not found." });
    }

    const previousReportSnapshot = toLabReportStoreInput(report);
    const previousReportKey = resolveImageKeyFromPayload(report.reportKey, report.reportUrl);

    const validation = await validateLabReportPayload(req.body, report);
    if (validation.error) {
      return res.status(400).json({ message: validation.error });
    }

    const nextReportKey = resolveImageKeyFromPayload(validation.value.reportKey, validation.value.reportUrl);
    validation.value.reportKey = nextReportKey;

    if (previousReportKey && previousReportKey !== nextReportKey && !isR2Configured()) {
      return res.status(503).json({ message: "Cloudflare R2 is not configured on the server." });
    }

    const updated = await updateLabReportById(req.params.id, validation.value);
    if (!updated) {
      return res.status(404).json({ message: "Lab report not found." });
    }

    if (previousReportKey && previousReportKey !== nextReportKey) {
      try {
        await deleteImageFromR2ByKey(previousReportKey);
      } catch (storageError) {
        console.error("Failed to delete previous lab report file from R2:", storageError);

        try {
          await updateLabReportById(req.params.id, previousReportSnapshot);
        } catch (rollbackError) {
          console.error("Failed to rollback lab report after R2 cleanup failure:", rollbackError);
          return res.status(502).json({
            message:
              "Lab report file cleanup failed and rollback also failed. Please inspect the lab report and R2 bucket manually.",
          });
        }

        if (nextReportKey && nextReportKey !== previousReportKey) {
          try {
            await deleteImageFromR2ByKey(nextReportKey);
          } catch (newFileCleanupError) {
            console.error("Failed to delete replacement lab report file during rollback:", newFileCleanupError);
          }
        }

        return res.status(502).json({
          message: "Lab report update reverted because old file cleanup failed.",
        });
      }
    }

    await invalidatePublicLabReportsCache();
    return res.json(updated);
  } catch (error) {
    next(error);
  }
});

app.delete(["/api/admin/lab-reports/:id", "/admin/lab-reports/:id"], requireAdminAccess, async (req, res, next) => {
  try {
    const report = await findLabReportById(req.params.id);
    if (!report) {
      return res.status(404).json({ message: "Lab report not found." });
    }

    const reportSnapshot = toLabReportStoreInput(report);
    const reportKey = resolveImageKeyFromPayload(report.reportKey, report.reportUrl);

    if (reportKey && !isR2Configured()) {
      return res.status(503).json({ message: "Cloudflare R2 is not configured on the server." });
    }

    const deleted = await deleteLabReportById(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "Lab report not found." });
    }

    if (reportKey) {
      try {
        await deleteImageFromR2ByKey(reportKey);
      } catch (storageError) {
        console.error("Failed to delete lab report file from R2:", storageError);

        try {
          await createLabReport({
            id: report.id,
            ...reportSnapshot,
          });
        } catch (rollbackError) {
          console.error("Failed to rollback lab report deletion after R2 cleanup failure:", rollbackError);
          return res.status(502).json({
            message:
              "Lab report deletion failed after database remove. Lab report rollback also failed; inspect database and R2 bucket manually.",
          });
        }

        return res.status(502).json({
          message: "Lab report deletion was reverted because file cleanup failed.",
        });
      }
    }

    await invalidatePublicLabReportsCache();
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
});


export default app;
