import { Router } from "express";
import * as core from "./index.js";

const app = Router();
Object.assign(globalThis, core);

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "hulkcore-backend",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/theme-settings", async (req, res, next) => {
  try {
    const queryCode = Array.isArray(req.query?.code) ? req.query.code[0] : req.query?.code;
    const normalizedCode = normalizeThemeCode(queryCode);

    if (queryCode && !normalizedCode) {
      return res.status(400).json({
        message:
          "Query parameter 'code' must be 2-64 chars using lowercase letters, numbers, hyphen, or underscore.",
      });
    }

    const themeSettings = await getThemeSettings(normalizedCode ?? DEFAULT_THEME_SETTINGS.customerCode);
    return res.json(themeSettings);
  } catch (error) {
    next(error);
  }
});

app.put("/api/theme-settings", async (req, res, next) => {
  try {
    const existingThemeSettings = await getThemeSettings(req.body?.customerCode ?? DEFAULT_THEME_SETTINGS.customerCode);
    const validation = validateThemeSettingsPayload(req.body, existingThemeSettings);

    if (validation.error) {
      return res.status(400).json({ message: validation.error });
    }

    const savedThemeSettings = await upsertThemeSettings(validation.value);
    return res.json(savedThemeSettings);
  } catch (error) {
    next(error);
  }
});

app.get("/api/home-content", async (req, res, next) => {
  try {
    const queryCode = Array.isArray(req.query?.code) ? req.query.code[0] : req.query?.code;
    const normalizedCode = normalizeThemeCode(queryCode);

    if (queryCode && !normalizedCode) {
      return res.status(400).json({
        message:
          "Query parameter 'code' must be 2-64 chars using lowercase letters, numbers, hyphen, or underscore.",
      });
    }

    const homeContent = await getHomeContent(normalizedCode ?? DEFAULT_HOME_CONTENT.customerCode);
    return res.json(homeContent);
  } catch (error) {
    next(error);
  }
});

app.put("/api/home-content", async (req, res, next) => {
  try {
    const existingHomeContent = await getHomeContent(req.body?.customerCode ?? DEFAULT_HOME_CONTENT.customerCode);
    const validation = validateHomeContentPayload(req.body, existingHomeContent);

    if (validation.error) {
      return res.status(400).json({ message: validation.error });
    }

    const savedHomeContent = await upsertHomeContent(validation.value);
    return res.json(savedHomeContent);
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/auth/login", async (req, res, next) => {
  try {
    const email = cleanText(req.body?.email).toLowerCase();
    const password = cleanText(req.body?.password);
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    if (email !== ADMIN_LOGIN_EMAIL || password !== ADMIN_LOGIN_PASSWORD) {
      return res.status(401).json({ message: "Invalid admin credentials." });
    }

    const sessionId = createId("adms");
    const session = createAdminSessionPayload(sessionId);
    await persistAdminSession(session);
    setCookie(res, ADMIN_AUTH_COOKIE_NAME, sessionId, {
      maxAge: ADMIN_SESSION_TTL_SEC,
      path: "/",
      httpOnly: true,
      secure: COOKIE_SECURE,
      sameSite: COOKIE_SAME_SITE,
    });

    return res.json({ session });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/auth/session", async (req, res, next) => {
  try {
    const session = await resolveAdminSession(req);
    if (!session) {
      return res.status(401).json({ message: "Admin session not found." });
    }

    return res.json({ session });
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/auth/logout", async (req, res, next) => {
  try {
    const sessionId = readCookieValue(req, ADMIN_AUTH_COOKIE_NAME);
    if (sessionId) {
      await deleteAdminSession(sessionId);
    }
    clearCookie(res, ADMIN_AUTH_COOKIE_NAME);
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.get(["/api/admin/nav-menus", "/admin/nav-menus"], requireAdminAccess, async (_req, res, next) => {
  try {
    const menus = await getNavMenus();
    return res.json({ menus });
  } catch (error) {
    next(error);
  }
});

app.post(["/api/admin/nav-menus", "/admin/nav-menus"], requireAdminAccess, async (req, res, next) => {
  try {
    const validation = validateNavMenuMetaPayload(req.body, {
      key: "",
      name: "",
      isActive: true,
    });
    if (validation.error) {
      return res.status(400).json(createErrorBody("NAV_MENU_INVALID", validation.error));
    }

    const duplicate = await findNavMenuByKey(validation.value.key);
    if (duplicate) {
      return res.status(409).json(createErrorBody("NAV_MENU_KEY_CONFLICT", "Menu key already exists."));
    }

    const created = await createNavMenu({
      id: createId("nvm"),
      key: validation.value.key,
      name: validation.value.name,
      isActive: validation.value.isActive,
    });
    return res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

app.get(["/api/admin/nav-menus/:id", "/admin/nav-menus/:id"], requireAdminAccess, async (req, res, next) => {
  try {
    const menuId = cleanText(req.params.id);
    if (!menuId) {
      return res.status(400).json(createErrorBody("NAV_MENU_ID_REQUIRED", "Menu id is required."));
    }

    const menu = await getNavMenuDraftById(menuId);
    if (!menu) {
      return res.status(404).json(createErrorBody("NAV_MENU_NOT_FOUND", "Navigation menu not found."));
    }

    return res.json(menu);
  } catch (error) {
    next(error);
  }
});

app.put(["/api/admin/nav-menus/:id", "/admin/nav-menus/:id"], requireAdminAccess, async (req, res, next) => {
  try {
    const menuId = cleanText(req.params.id);
    if (!menuId) {
      return res.status(400).json(createErrorBody("NAV_MENU_ID_REQUIRED", "Menu id is required."));
    }

    const existing = await findNavMenuById(menuId);
    if (!existing) {
      return res.status(404).json(createErrorBody("NAV_MENU_NOT_FOUND", "Navigation menu not found."));
    }

    const validation = validateNavMenuMetaPayload(req.body, existing);
    if (validation.error) {
      return res.status(400).json(createErrorBody("NAV_MENU_INVALID", validation.error));
    }

    if (validation.value.key !== existing.key) {
      const duplicate = await findNavMenuByKey(validation.value.key);
      if (duplicate && duplicate.id !== menuId) {
        return res.status(409).json(createErrorBody("NAV_MENU_KEY_CONFLICT", "Menu key already exists."));
      }
    }

    const updated = await updateNavMenuById(menuId, validation.value);
    if (!updated) {
      return res.status(404).json(createErrorBody("NAV_MENU_NOT_FOUND", "Navigation menu not found."));
    }

    await invalidatePublicNavCache(existing.key);
    if (validation.value.key !== existing.key) {
      await invalidatePublicNavCache(validation.value.key);
    }
    return res.json(updated);
  } catch (error) {
    next(error);
  }
});

app.put(["/api/admin/nav-menus/:id/items", "/admin/nav-menus/:id/items"], requireAdminAccess, async (req, res, next) => {
  try {
    const menuId = cleanText(req.params.id);
    if (!menuId) {
      return res.status(400).json(createErrorBody("NAV_MENU_ID_REQUIRED", "Menu id is required."));
    }

    const existingMenu = await findNavMenuById(menuId);
    if (!existingMenu) {
      return res.status(404).json(createErrorBody("NAV_MENU_NOT_FOUND", "Navigation menu not found."));
    }

    const validation = validateNavMenuItemsPayload(req.body);
    if (validation.error) {
      return res.status(400).json(createErrorBody("NAV_ITEMS_INVALID", validation.error));
    }

    const saved = await replaceNavMenuItems(menuId, validation.value);
    if (!saved) {
      return res.status(404).json(createErrorBody("NAV_MENU_NOT_FOUND", "Navigation menu not found."));
    }

    const previewPayload = buildPublishedNavMenu(
      {
        id: saved.id,
        key: saved.key,
        name: saved.name,
        isActive: saved.isActive,
        version: saved.version,
        updatedAt: saved.updatedAt,
      },
      saved.items,
      new Date().toISOString(),
    );

    await invalidatePublicNavCache(saved.key);
    return res.json({
      ...saved,
      preview: previewPayload,
    });
  } catch (error) {
    next(error);
  }
});

app.post(["/api/admin/nav-menus/:id/publish", "/admin/nav-menus/:id/publish"], requireAdminAccess, async (req, res, next) => {
  try {
    const menuId = cleanText(req.params.id);
    if (!menuId) {
      return res.status(400).json(createErrorBody("NAV_MENU_ID_REQUIRED", "Menu id is required."));
    }

    const draft = await getNavMenuDraftById(menuId);
    if (!draft) {
      return res.status(404).json(createErrorBody("NAV_MENU_NOT_FOUND", "Navigation menu not found."));
    }

    if (!Array.isArray(draft.items) || draft.items.length === 0) {
      return res
        .status(409)
        .json(createErrorBody("NAV_MENU_EMPTY", "Add at least one menu item before publishing."));
    }

    const publishedPayload = buildPublishedNavMenu(
      {
        id: draft.id,
        key: draft.key,
        name: draft.name,
        isActive: draft.isActive,
        version: Number(draft.version ?? 0) + 1,
        updatedAt: draft.updatedAt,
      },
      draft.items,
      new Date().toISOString(),
    );

    const published = await publishNavMenuById(menuId, publishedPayload);
    if (!published) {
      return res.status(404).json(createErrorBody("NAV_MENU_NOT_FOUND", "Navigation menu not found."));
    }

    await invalidatePublicNavCache(draft.key);
    return res.json(published);
  } catch (error) {
    next(error);
  }
});

app.get(["/api/public/nav-menus/:key", "/public/nav-menus/:key"], async (req, res, next) => {
  try {
    const menuKey = cleanText(req.params.key).toLowerCase();
    if (!menuKey) {
      return res.status(400).json(createErrorBody("NAV_MENU_KEY_REQUIRED", "Menu key is required."));
    }

    let cacheEntry = await readPublicNavCacheEntry(menuKey);

    if (!cacheEntry) {
      const publishedMenu = await getPublishedNavMenuByKey(menuKey);
      if (!publishedMenu) {
        return res.status(404).json(createErrorBody("NAV_MENU_NOT_FOUND", "Published navigation menu not found."));
      }

      cacheEntry = await cachePublicNavMenu(menuKey, publishedMenu);
    }

    const ifNoneMatch = cleanText(req.get("if-none-match"));
    if (ifNoneMatch && ifNoneMatch === cacheEntry.etag) {
      res.setHeader("ETag", cacheEntry.etag);
      res.setHeader("Cache-Control", NAV_PUBLIC_CACHE_CONTROL);
      return res.status(304).send();
    }

    res.setHeader("ETag", cacheEntry.etag);
    res.setHeader("Cache-Control", NAV_PUBLIC_CACHE_CONTROL);
    return res.json(cacheEntry.payload);
  } catch (error) {
    next(error);
  }
});


export default app;
