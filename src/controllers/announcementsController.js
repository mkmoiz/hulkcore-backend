import { Router } from "express";
import * as core from "./index.js";

const app = Router();
Object.assign(globalThis, core);

/* ─── Public: active announcements only ─── */
app.get(["/api/public/announcements", "/public/announcements"], async (_req, res, next) => {
  try {
    const items = await getAnnouncements();
    const activeItems = items.filter((item) => item.isActive);
    return res.json({ items: activeItems });
  } catch (error) {
    next(error);
  }
});

/* ─── Admin: list all ─── */
app.get(["/api/admin/announcements", "/admin/announcements"], requireAdminAccess, async (_req, res, next) => {
  try {
    const items = await getAnnouncements();
    return res.json({ items });
  } catch (error) {
    next(error);
  }
});

/* ─── Admin: create ─── */
app.post(["/api/admin/announcements", "/admin/announcements"], requireAdminAccess, async (req, res, next) => {
  try {
    const { text, href, sortOrder, isActive } = req.body;

    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ message: "Announcement text is required." });
    }

    const item = await createAnnouncement({
      id: createId("ann"),
      text: text.trim(),
      href: typeof href === "string" ? href.trim() : "",
      sortOrder: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0,
      isActive: isActive !== false,
    });

    return res.status(201).json(item);
  } catch (error) {
    next(error);
  }
});

/* ─── Admin: update ─── */
app.put(["/api/admin/announcements/:id", "/admin/announcements/:id"], requireAdminAccess, async (req, res, next) => {
  try {
    const existing = await findAnnouncementById(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: "Announcement not found." });
    }

    const { text, href, sortOrder, isActive } = req.body;

    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ message: "Announcement text is required." });
    }

    const updated = await updateAnnouncementById(req.params.id, {
      text: text.trim(),
      href: typeof href === "string" ? href.trim() : "",
      sortOrder: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0,
      isActive: isActive !== false,
    });

    if (!updated) {
      return res.status(404).json({ message: "Announcement not found." });
    }

    return res.json(updated);
  } catch (error) {
    next(error);
  }
});

/* ─── Admin: delete ─── */
app.delete(["/api/admin/announcements/:id", "/admin/announcements/:id"], requireAdminAccess, async (req, res, next) => {
  try {
    const deleted = await deleteAnnouncementById(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "Announcement not found." });
    }
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default app;
