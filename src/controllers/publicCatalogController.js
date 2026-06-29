import { Router } from "express";
import * as core from "./index.js";

const app = Router();
Object.assign(globalThis, core);

app.get(["/api/public/categories", "/public/categories"], async (_req, res, next) => {
  try {
    const cached = await getCacheJson("public:categories:latest");
    if (cached && Array.isArray(cached.categories)) {
      return res.json(cached);
    }

    const categories = await getCategories();
    const payload = { categories };
    await setCacheJson("public:categories:latest", payload, PUBLIC_ENTITY_CACHE_TTL_SEC);
    return res.json(payload);
  } catch (error) {
    next(error);
  }
});

app.get(["/api/public/levels", "/public/levels"], async (_req, res, next) => {
  try {
    const cached = await getCacheJson(PUBLIC_LEVELS_CACHE_KEY);
    if (cached && Array.isArray(cached.levels)) {
      return res.json(cached);
    }

    const levels = await getLevels(false);
    const requiresDynamicProducts = levels.some((level) => level.ruleMode === "DYNAMIC");
    const allProducts = requiresDynamicProducts ? (await getProducts()).filter((product) => product.isActive) : [];

    const payload = levels.map((level) => {
      const includeSet = new Set(level.includeCategoryIds ?? []);
      const baseEntries =
        level.ruleMode === "DYNAMIC"
          ? allProducts
            .filter((product) => {
              if (includeSet.size === 0) {
                return true;
              }
              return includeSet.has(product.categoryId);
            })
            .map((product, index) => ({
              id: `dyn_${level.id}_${product.id}`,
              levelId: level.id,
              productId: product.id,
              position: index,
              isPinned: false,
              product,
            }))
          : (level.levelProducts ?? []).filter((entry) => entry.product?.isActive);

      const sortedEntries = sortLevelEntries(baseEntries, normalizeLevelSortMode(level.sortMode, "featured"));
      const previewProducts = sortedEntries.slice(0, 4).map((entry) => entry.product).filter(Boolean);
      return {
        ...toPublicLevelShape(level, sortedEntries.length),
        previewProducts,
      };
    });

    const responsePayload = { levels: payload };
    await setCacheJson(PUBLIC_LEVELS_CACHE_KEY, responsePayload, PUBLIC_ENTITY_CACHE_TTL_SEC);
    return res.json(responsePayload);
  } catch (error) {
    next(error);
  }
});

app.get(["/api/public/levels/:slug", "/public/levels/:slug"], async (req, res, next) => {
  try {
    const slug = cleanText(req.params.slug).toLowerCase();
    if (!slug) {
      return res.status(400).json({ message: "Level slug is required." });
    }

    const level = await findLevelBySlug(slug, false);
    if (!level) {
      return res.status(404).json({ message: "Level not found." });
    }

    const requestedSort = normalizeLevelSortMode(
      Array.isArray(req.query.sort) ? req.query.sort[0] : req.query.sort,
      normalizeLevelSortMode(level.sortMode, "featured"),
    );
    const requestedPage = parsePositiveInt(Array.isArray(req.query.page) ? req.query.page[0] : req.query.page, 1);
    const requestedPageSize = parsePositiveInt(
      Array.isArray(req.query.pageSize) ? req.query.pageSize[0] : req.query.pageSize,
      12,
    );
    const pageSize = Math.min(48, Math.max(1, requestedPageSize));
    const levelDetailCacheKey = `${PUBLIC_LEVEL_DETAIL_CACHE_PREFIX}${slug}:sort:${requestedSort}:page:${requestedPage}:size:${pageSize}`;
    const cached = await getCacheJson(levelDetailCacheKey);
    if (cached && cached.level?.slug === slug) {
      return res.json(cached);
    }

    let baseEntries = [];
    if (level.ruleMode === "DYNAMIC") {
      const allProducts = (await getProducts()).filter((product) => product.isActive);
      const includeSet = new Set(level.includeCategoryIds ?? []);
      baseEntries = allProducts
        .filter((product) => {
          if (includeSet.size === 0) {
            return true;
          }
          return includeSet.has(product.categoryId);
        })
        .map((product, index) => ({
          id: `dyn_${level.id}_${product.id}`,
          levelId: level.id,
          productId: product.id,
          position: index,
          isPinned: false,
          product,
        }));
    } else {
      baseEntries = (level.levelProducts ?? []).filter((entry) => entry.product?.isActive);
    }

    const sortedEntries = sortLevelEntries(baseEntries, requestedSort);
    const total = sortedEntries.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(requestedPage, totalPages);
    const startIndex = (page - 1) * pageSize;
    const paginatedEntries = sortedEntries.slice(startIndex, startIndex + pageSize);

    const responsePayload = {
      level: toPublicLevelShape(level, total),
      sort: requestedSort,
      page,
      pageSize,
      total,
      totalPages,
      products: paginatedEntries,
    };
    await setCacheJson(levelDetailCacheKey, responsePayload, PUBLIC_ENTITY_CACHE_TTL_SEC);
    return res.json(responsePayload);
  } catch (error) {
    next(error);
  }
});

app.get(["/api/public/offers", "/public/offers"], async (_req, res, next) => {
  try {
    const cached = await getCacheJson(PUBLIC_OFFERS_CACHE_KEY);
    if (cached && Array.isArray(cached.items)) {
      return res.json(cached);
    }

    const offers = await getOfferProducts(false);
    const payload = { items: offers.filter((entry) => entry.product?.isActive) };
    await setCacheJson(PUBLIC_OFFERS_CACHE_KEY, payload, PUBLIC_ENTITY_CACHE_TTL_SEC);
    return res.json(payload);
  } catch (error) {
    next(error);
  }
});

app.get(["/api/public/combo-offers", "/public/combo-offers"], async (_req, res, next) => {
  try {
    const cached = await getCacheJson(PUBLIC_COMBO_OFFERS_CACHE_KEY);
    if (cached && Array.isArray(cached.items)) {
      return res.json(cached);
    }

    const items = await getComboOffers(false);
    const payload = {
      items: items.filter((entry) => entry.status === "active" && Array.isArray(entry.products) && entry.products.length > 1),
    };
    await setCacheJson(PUBLIC_COMBO_OFFERS_CACHE_KEY, payload, PUBLIC_ENTITY_CACHE_TTL_SEC);
    return res.json(payload);
  } catch (error) {
    next(error);
  }
});

app.get(["/api/public/best-sellers", "/public/best-sellers"], async (_req, res, next) => {
  try {
    const cached = await getCacheJson(PUBLIC_BEST_SELLERS_CACHE_KEY);
    if (cached && Array.isArray(cached.items)) {
      return res.json(cached);
    }

    const items = await getBestSellerProducts(false);
    const payload = { items: items.filter((entry) => entry.product?.isActive) };
    await setCacheJson(PUBLIC_BEST_SELLERS_CACHE_KEY, payload, PUBLIC_ENTITY_CACHE_TTL_SEC);
    return res.json(payload);
  } catch (error) {
    next(error);
  }
});

app.get(["/api/public/lab-reports", "/public/lab-reports"], async (_req, res, next) => {
  try {
    const cached = await getCacheJson(PUBLIC_LAB_REPORTS_CACHE_KEY);
    if (cached && Array.isArray(cached.reports)) {
      return res.json(cached);
    }

    const reports = await getLabReports(false);
    const payload = { reports: reports.filter((report) => report.isActive) };
    await setCacheJson(PUBLIC_LAB_REPORTS_CACHE_KEY, payload, PUBLIC_ENTITY_CACHE_TTL_SEC);
    return res.json(payload);
  } catch (error) {
    next(error);
  }
});

app.get(["/api/public/products/search", "/public/products/search"], async (req, res, next) => {
  try {
    const q = req.query.q;
    const query = typeof q === "string" ? q.trim() : "";
    if (!query) {
      return res.json({ products: [] });
    }

    const searchCacheKey = `public:search:q:${query.toLowerCase()}`;
    const cached = await getCacheJson(searchCacheKey);
    if (cached && Array.isArray(cached.products)) {
      return res.json(cached);
    }

    const products = await searchProducts(query);
    const payload = { products };
    await setCacheJson(searchCacheKey, payload, 300); // Cache search queries for 5 minutes
    return res.json(payload);
  } catch (error) {
    next(error);
  }
});

export default app;
