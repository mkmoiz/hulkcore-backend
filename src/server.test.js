import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const storeMocks = vi.hoisted(() => ({
  DEFAULT_HOME_CONTENT: {
    customerCode: "default",
    stats: [{ value: "100%", label: "Authenticity", iconKey: "verified" }],
    features: [{ title: "Transparent Labeling", description: "No proprietary blends", iconKey: "award" }],
    benefits: [{ title: "Strength", description: "Higher output", iconKey: "weight-lifting" }],
    bundles: [
      {
        name: "Starter Stack",
        description: "Beginner friendly",
        items: ["Whey", "Creatine"],
        saveLabel: "Save 10%",
        cta: "Buy Stack",
      },
    ],
    reviews: [{ name: "Moiz", goal: "Muscle", quote: "Works great", rating: "4.9/5" }],
    articles: [{ title: "Whey Guide", summary: "Basics", tag: "Protein", readTime: "4 min" }],
  },
  initStore: vi.fn(),
  getNavMenus: vi.fn(),
  findNavMenuById: vi.fn(),
  findNavMenuByKey: vi.fn(),
  getNavMenuDraftById: vi.fn(),
  createNavMenu: vi.fn(),
  updateNavMenuById: vi.fn(),
  replaceNavMenuItems: vi.fn(),
  publishNavMenuById: vi.fn(),
  getPublishedNavMenuByKey: vi.fn(),
  getHomeContent: vi.fn(),
  upsertHomeContent: vi.fn(),
  getCategories: vi.fn(),
  findCategoryById: vi.fn(),
  findCategoryByName: vi.fn(),
  createCategory: vi.fn(),
  updateCategoryById: vi.fn(),
  countProductsByCategoryId: vi.fn(),
  deleteCategoryById: vi.fn(),
  categoryExists: vi.fn(),
  getProducts: vi.fn(),
  findProductById: vi.fn(),
  createProduct: vi.fn(),
  updateProductById: vi.fn(),
  deleteProductById: vi.fn(),
  getCollections: vi.fn(),
  findCollectionById: vi.fn(),
  findCollectionByName: vi.fn(),
  createCollection: vi.fn(),
  updateCollectionById: vi.fn(),
  deleteCollectionById: vi.fn(),
  replaceCollectionCategoryAssignments: vi.fn(),
  getLevels: vi.fn(),
  findLevelById: vi.fn(),
  findLevelBySlug: vi.fn(),
  findLevelByName: vi.fn(),
  createLevel: vi.fn(),
  updateLevelById: vi.fn(),
  deleteLevelById: vi.fn(),
  replaceLevelProductAssignments: vi.fn(),
  getOfferProducts: vi.fn(),
  replaceOfferProducts: vi.fn(),
  getBestSellerProducts: vi.fn(),
  replaceBestSellerProducts: vi.fn(),
  getLabReports: vi.fn(),
  findLabReportById: vi.fn(),
  createLabReport: vi.fn(),
  updateLabReportById: vi.fn(),
  deleteLabReportById: vi.fn(),
  getCarouselImages: vi.fn(),
  findCarouselImageById: vi.fn(),
  createCarouselImage: vi.fn(),
  updateCarouselImageById: vi.fn(),
  deleteCarouselImageById: vi.fn(),
  getOrCreateActiveCart: vi.fn(),
  getCartByCustomerRef: vi.fn(),
  addItemToCart: vi.fn(),
  updateCartItemQuantity: vi.fn(),
  removeCartItem: vi.fn(),
  createOrderFromCart: vi.fn(),
  getOrdersByCustomerRef: vi.fn(),
  getOrdersForAdmin: vi.fn(),
  findOrderById: vi.fn(),
  findOrderByGatewayPaymentId: vi.fn(),
  updateOrderById: vi.fn(),
  createOtpChallenge: vi.fn(),
  createEmailOtpChallenge: vi.fn(),
  verifyOtpChallengeAndCreateSession: vi.fn(),
  verifyEmailOtpChallengeAndCreateSession: vi.fn(),
  findAuthSessionByToken: vi.fn(),
  deleteAuthSessionByToken: vi.fn(),
}));

const r2Mocks = vi.hoisted(() => ({
  deleteImageFromR2ByKey: vi.fn(),
  extractR2KeyFromImageUrl: vi.fn(),
  isR2Configured: vi.fn(),
  uploadImageToR2: vi.fn(),
}));

vi.mock("./store.js", () => storeMocks);
vi.mock("./r2.js", () => r2Mocks);

const ADMIN_TEST_TOKEN = "test-admin-token";
process.env.NODE_ENV = "test";
process.env.ADMIN_API_TOKEN = ADMIN_TEST_TOKEN;

const { app } = await import("./server.js");

const baseProduct = {
  id: "prod_1",
  name: "Whey",
  description: "Protein",
  imageUrl: "https://cdn.example.com/products/old-image.png",
  imageKey: "products/old-image.png",
  sku: "SKU-01",
  categoryId: "cat_1",
  price: 10,
  stock: 2,
  isActive: true,
};

const baseCarouselImage = {
  id: "carimg_1",
  title: "Hero 1",
  imageUrl: "https://cdn.example.com/carousel/old-image.png",
  imageKey: "carousel/old-image.png",
  sortOrder: 0,
  isActive: true,
};


const baseHomeContent = {
  customerCode: "default",
  stats: [{ value: "100%", label: "Authenticity", iconKey: "verified" }],
  features: [{ title: "Transparent Labeling", description: "No proprietary blends", iconKey: "award" }],
  benefits: [{ title: "Strength", description: "Higher output", iconKey: "weight-lifting" }],
  bundles: [
    {
      name: "Starter Stack",
      description: "Beginner friendly",
      items: ["Whey", "Creatine"],
      saveLabel: "Save 10%",
      cta: "Buy Stack",
    },
  ],
  reviews: [{ name: "Moiz", goal: "Muscle", quote: "Works great", rating: "4.9/5" }],
  articles: [{ title: "Whey Guide", summary: "Basics", tag: "Protein", readTime: "4 min" }],
  updatedAt: new Date().toISOString(),
};

const baseNavDraft = {
  id: "nvm_1",
  key: "main_secondary",
  name: "Main Secondary Navigation",
  isActive: true,
  version: 1,
  publishedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  items: [
    {
      id: "nvi_1",
      menuId: "nvm_1",
      label: "All Products",
      type: "DROPDOWN",
      href: "",
      target: "_self",
      position: 0,
      isVisible: true,
      icon: "",
      dropdownGroups: [
        {
          id: "nvg_1",
          navItemId: "nvi_1",
          title: "Shop",
          position: 0,
          links: [{ id: "nvl_1", groupId: "nvg_1", label: "Whey", href: "/whey", position: 0, badge: "", trackingTag: "" }],
        },
      ],
      promoTiles: [],
    },
    {
      id: "nvi_2",
      menuId: "nvm_1",
      label: "Offers",
      type: "LINK",
      href: "/offers",
      target: "_self",
      position: 1,
      isVisible: true,
      icon: "",
      dropdownGroups: [],
      promoTiles: [],
    },
  ],
};

const basePublishedNavMenu = {
  id: "nvm_1",
  key: "main_secondary",
  name: "Main Secondary Navigation",
  isActive: true,
  version: 2,
  publishedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  items: baseNavDraft.items,
};

const baseLevel = {
  id: "lvl_1",
  slug: "beginner",
  name: "Beginner",
  description: "Start your supplement journey.",
  imageUrl: "https://cdn.example.com/levels/beginner.png",
  imageKey: "levels/beginner.png",
  position: 0,
  isActive: true,
  ruleMode: "CURATED",
  sortMode: "featured",
  includeCategoryIds: ["cat_1"],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  levelProducts: [
    {
      id: "lvp_1",
      levelId: "lvl_1",
      productId: "prod_1",
      position: 0,
      isPinned: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      product: {
        ...baseProduct,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    },
  ],
};

const baseLabReport = {
  id: "lbr_1",
  title: "Batch Purity Report",
  description: "Purity and heavy metal validation",
  reportUrl: "https://cdn.example.com/lab-reports/old-report.pdf",
  reportKey: "lab-reports/old-report.pdf",
  productId: "",
  isActive: true,
  position: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  product: null,
};

const baseCart = {
  id: "cart_1",
  customerRef: "guest_1",
  status: "active",
  itemCount: 1,
  totalQuantity: 1,
  subtotal: 10,
  items: [
    {
      id: "cartitem_1",
      cartId: "cart_1",
      productId: "prod_1",
      quantity: 1,
      unitPrice: 10,
      lineTotal: 10,
      product: {
        id: "prod_1",
        name: "Whey",
        imageUrl: "https://cdn.example.com/products/old-image.png",
      },
    },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const baseOrder = {
  id: "ord_1",
  cartId: "cart_1",
  customerRef: "guest_1",
  customerName: "Moiz Khan",
  customerEmail: "moiz@example.com",
  customerPhone: "9999999999",
  shippingAddress: {
    line1: "Street 1",
    city: "Delhi",
    state: "Delhi",
    postalCode: "110001",
    country: "IN",
  },
  paymentMethod: "cod",
  currency: "INR",
  status: "placed",
  subtotal: 10,
  shippingFee: 0,
  total: 10,
  placedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  items: [
    {
      id: "orditem_1",
      orderId: "ord_1",
      productId: "prod_1",
      productName: "Whey",
      quantity: 1,
      unitPrice: 10,
      lineTotal: 10,
    },
  ],
};

const baseAuthSession = {
  token: "auth_1",
  expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  user: {
    id: "usr_1",
    phone: "+919999999999",
    email: "moiz@example.com",
    fullName: "Moiz Khan",
    isVerified: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
};

beforeEach(() => {
  vi.clearAllMocks();

  storeMocks.getNavMenus.mockResolvedValue([basePublishedNavMenu]);
  storeMocks.findNavMenuById.mockResolvedValue(baseNavDraft);
  storeMocks.findNavMenuByKey.mockResolvedValue(baseNavDraft);
  storeMocks.getNavMenuDraftById.mockResolvedValue(baseNavDraft);
  storeMocks.createNavMenu.mockResolvedValue(baseNavDraft);
  storeMocks.updateNavMenuById.mockResolvedValue(baseNavDraft);
  storeMocks.replaceNavMenuItems.mockResolvedValue(baseNavDraft);
  storeMocks.publishNavMenuById.mockResolvedValue(basePublishedNavMenu);
  storeMocks.getPublishedNavMenuByKey.mockResolvedValue(basePublishedNavMenu);

  storeMocks.getHomeContent.mockResolvedValue(baseHomeContent);
  storeMocks.upsertHomeContent.mockImplementation(async (input) => ({
    ...baseHomeContent,
    ...input,
  }));
  storeMocks.getCategories.mockResolvedValue([]);
  storeMocks.findCategoryById.mockResolvedValue(null);
  storeMocks.findCategoryByName.mockResolvedValue(null);
  storeMocks.createCategory.mockResolvedValue(null);
  storeMocks.updateCategoryById.mockResolvedValue(null);
  storeMocks.countProductsByCategoryId.mockResolvedValue(0);
  storeMocks.deleteCategoryById.mockResolvedValue(true);
  storeMocks.categoryExists.mockResolvedValue(true);
  storeMocks.getProducts.mockResolvedValue([]);
  storeMocks.findProductById.mockResolvedValue(null);
  storeMocks.createProduct.mockResolvedValue(baseProduct);
  storeMocks.updateProductById.mockResolvedValue(baseProduct);
  storeMocks.deleteProductById.mockResolvedValue(true);
  storeMocks.getCollections.mockResolvedValue([]);
  storeMocks.findCollectionById.mockResolvedValue(null);
  storeMocks.findCollectionByName.mockResolvedValue(null);
  storeMocks.createCollection.mockResolvedValue(null);
  storeMocks.updateCollectionById.mockResolvedValue(null);
  storeMocks.deleteCollectionById.mockResolvedValue(true);
  storeMocks.replaceCollectionCategoryAssignments.mockResolvedValue(null);
  storeMocks.getLevels.mockResolvedValue([baseLevel]);
  storeMocks.findLevelById.mockResolvedValue(baseLevel);
  storeMocks.findLevelBySlug.mockResolvedValue(baseLevel);
  storeMocks.findLevelByName.mockResolvedValue(null);
  storeMocks.createLevel.mockResolvedValue(baseLevel);
  storeMocks.updateLevelById.mockResolvedValue(baseLevel);
  storeMocks.deleteLevelById.mockResolvedValue(true);
  storeMocks.replaceLevelProductAssignments.mockResolvedValue(baseLevel);
  storeMocks.getOfferProducts.mockResolvedValue([]);
  storeMocks.replaceOfferProducts.mockResolvedValue([]);
  storeMocks.getBestSellerProducts.mockResolvedValue([]);
  storeMocks.replaceBestSellerProducts.mockResolvedValue([]);
  storeMocks.getLabReports.mockResolvedValue([]);
  storeMocks.findLabReportById.mockResolvedValue(null);
  storeMocks.createLabReport.mockResolvedValue(null);
  storeMocks.updateLabReportById.mockResolvedValue(null);
  storeMocks.deleteLabReportById.mockResolvedValue(true);
  storeMocks.getCarouselImages.mockResolvedValue([]);
  storeMocks.findCarouselImageById.mockResolvedValue(null);
  storeMocks.createCarouselImage.mockResolvedValue(baseCarouselImage);
  storeMocks.updateCarouselImageById.mockResolvedValue(baseCarouselImage);
  storeMocks.deleteCarouselImageById.mockResolvedValue(true);
  storeMocks.getOrCreateActiveCart.mockResolvedValue(baseCart);
  storeMocks.getCartByCustomerRef.mockResolvedValue(baseCart);
  storeMocks.addItemToCart.mockResolvedValue(baseCart);
  storeMocks.updateCartItemQuantity.mockResolvedValue(baseCart);
  storeMocks.removeCartItem.mockResolvedValue(baseCart);
  storeMocks.createOrderFromCart.mockResolvedValue(baseOrder);
  storeMocks.getOrdersByCustomerRef.mockResolvedValue([baseOrder]);
  storeMocks.getOrdersForAdmin.mockResolvedValue({
    total: 1,
    limit: 50,
    offset: 0,
    orders: [baseOrder],
  });
  storeMocks.findOrderById.mockResolvedValue(baseOrder);
  storeMocks.findOrderByGatewayPaymentId.mockResolvedValue(null);
  storeMocks.updateOrderById.mockResolvedValue(baseOrder);
  storeMocks.createOtpChallenge.mockResolvedValue({
    id: "otp_1",
    phone: "+919999999999",
    expiresAt: new Date(Date.now() + 300000).toISOString(),
    attemptsRemaining: 5,
    createdAt: new Date().toISOString(),
  });
  storeMocks.createEmailOtpChallenge.mockResolvedValue({
    id: "eotp_1",
    email: "moiz@example.com",
    expiresAt: new Date(Date.now() + 300000).toISOString(),
    attemptsRemaining: 5,
    createdAt: new Date().toISOString(),
  });
  storeMocks.verifyOtpChallengeAndCreateSession.mockResolvedValue(baseAuthSession);
  storeMocks.verifyEmailOtpChallengeAndCreateSession.mockResolvedValue(baseAuthSession);
  storeMocks.findAuthSessionByToken.mockResolvedValue(baseAuthSession);
  storeMocks.deleteAuthSessionByToken.mockResolvedValue(true);

  r2Mocks.deleteImageFromR2ByKey.mockResolvedValue(undefined);
  r2Mocks.extractR2KeyFromImageUrl.mockReturnValue("");
  r2Mocks.isR2Configured.mockReturnValue(true);
  r2Mocks.uploadImageToR2.mockResolvedValue({
    imageUrl: "https://cdn.example.com/products/new-image.png",
    imageKey: "products/new-image.png",
  });
});

describe("backend api", () => {
  it("returns health status", async () => {
    const response = await request(app).get("/api/health");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
  });

  it("requires admin authentication for nav menu admin endpoints", async () => {
    const response = await request(app).get("/api/admin/nav-menus");
    expect(response.status).toBe(401);
    expect(response.body.error?.code).toBe("ADMIN_AUTH_REQUIRED");
  });

  it("returns nav menus for admin", async () => {
    const response = await request(app).get("/api/admin/nav-menus").set("x-admin-token", ADMIN_TEST_TOKEN);
    expect(response.status).toBe(200);
    expect(response.body.menus).toHaveLength(1);
    expect(storeMocks.getNavMenus).toHaveBeenCalledTimes(1);
  });

  it("publishes nav menu and returns published payload", async () => {
    const response = await request(app).post("/api/admin/nav-menus/nvm_1/publish").set("x-admin-token", ADMIN_TEST_TOKEN);

    expect(response.status).toBe(200);
    expect(response.body.key).toBe("main_secondary");
    expect(storeMocks.publishNavMenuById).toHaveBeenCalledTimes(1);
  });

  it("returns public nav menu with ETag", async () => {
    const response = await request(app).get("/api/public/nav-menus/main_secondary");
    expect(response.status).toBe(200);
    expect(response.headers.etag).toBeTruthy();
    expect(response.body.key).toBe("main_secondary");
  });

  it("returns 304 for unchanged public nav menu ETag", async () => {
    const first = await request(app).get("/api/public/nav-menus/main_secondary");
    const second = await request(app).get("/api/public/nav-menus/main_secondary").set("if-none-match", first.headers.etag);

    expect(first.status).toBe(200);
    expect(second.status).toBe(304);
  });

  it("returns admin levels", async () => {
    const response = await request(app).get("/api/admin/levels").set("x-admin-token", ADMIN_TEST_TOKEN);
    expect(response.status).toBe(200);
    expect(response.body.levels).toHaveLength(1);
    expect(response.body.levels[0].slug).toBe("beginner");
    expect(storeMocks.getLevels).toHaveBeenCalledWith(true);
  });

  it("returns public levels list with preview products", async () => {
    const response = await request(app).get("/api/public/levels");
    expect(response.status).toBe(200);
    expect(response.body.levels).toHaveLength(1);
    expect(response.body.levels[0].slug).toBe("beginner");
    expect(response.body.levels[0].previewProducts).toHaveLength(1);
  });

  it("returns public level detail payload with paginated products", async () => {
    const response = await request(app).get("/api/public/levels/beginner?page=1&pageSize=12&sort=featured");
    expect(response.status).toBe(200);
    expect(response.body.level.slug).toBe("beginner");
    expect(response.body.products).toHaveLength(1);
    expect(response.body.total).toBe(1);
    expect(response.body.page).toBe(1);
  });

  it("returns public lab reports", async () => {
    storeMocks.getLabReports.mockResolvedValueOnce([
      {
        ...baseLabReport,
        id: "lbr_active",
        isActive: true,
      },
      {
        ...baseLabReport,
        id: "lbr_inactive",
        isActive: false,
      },
    ]);

    const response = await request(app).get("/api/public/lab-reports");
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.reports)).toBe(true);
    expect(response.body.reports).toHaveLength(1);
    expect(response.body.reports[0].id).toBe("lbr_active");
    expect(storeMocks.getLabReports).toHaveBeenCalledWith(false);
  });

  it("uses route level id for level product assignment updates", async () => {
    storeMocks.findLevelById.mockResolvedValueOnce({
      ...baseLevel,
      id: null,
    });
    storeMocks.findProductById.mockResolvedValueOnce(baseProduct);

    const response = await request(app)
      .put("/api/admin/levels/lvl-route-id/products")
      .set("x-admin-token", ADMIN_TEST_TOKEN)
      .send({
        items: [
          {
            productId: baseProduct.id,
            position: 0,
            isPinned: false,
          },
        ],
      });

    expect(response.status).toBe(200);
    expect(storeMocks.replaceLevelProductAssignments).toHaveBeenCalledWith("lvl-route-id", [
      {
        productId: baseProduct.id,
        position: 0,
        isPinned: false,
      },
    ]);
  });

  it("rejects image upload when R2 is not configured", async () => {
    r2Mocks.isR2Configured.mockReturnValue(false);

    const response = await request(app)
      .post("/api/images")
      .attach("image", Buffer.from("fake-image"), "sample.png");

    expect(response.status).toBe(503);
    expect(response.body.message).toMatch(/not configured/i);
  });


  it("returns home content", async () => {
    const response = await request(app).get("/api/home-content");

    expect(response.status).toBe(200);
    expect(response.body.customerCode).toBe("default");
    expect(storeMocks.getHomeContent).toHaveBeenCalledWith("default");
  });

  it("updates home content", async () => {
    const response = await request(app).put("/api/home-content").send({
      customerCode: "default",
      stats: [{ value: "24/7", label: "Support", iconKey: "zap" }],
      features: [{ title: "Certified", description: "Lab tested", iconKey: "award" }],
      benefits: [{ title: "Recovery", description: "Less soreness", iconKey: "biceps" }],
      bundles: [
        {
          name: "Recovery Stack",
          description: "Night formula",
          items: ["Casein", "Magnesium"],
          saveLabel: "Save 12%",
          cta: "Get Bundle",
        },
      ],
      reviews: [{ name: "Ari", goal: "Recovery", quote: "Good", rating: "4.8/5" }],
      articles: [{ title: "Creatine 101", summary: "Guide", tag: "Creatine", readTime: "5 min" }],
    });

    expect(response.status).toBe(200);
    expect(storeMocks.upsertHomeContent).toHaveBeenCalledTimes(1);
    expect(response.body.stats[0].label).toBe("Support");
  });

  it("rejects invalid home content payload", async () => {
    const response = await request(app).put("/api/home-content").send({
      customerCode: "default",
      stats: [{ value: "", label: "Support", iconKey: "zap" }],
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/invalid stats entry/i);
  });


  it("uploads image and returns image metadata", async () => {
    const response = await request(app)
      .post("/api/images")
      .attach("image", Buffer.from("fake-image"), "sample.png");

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      imageUrl: "https://cdn.example.com/products/new-image.png",
      imageKey: "products/new-image.png",
    });
    expect(r2Mocks.uploadImageToR2).toHaveBeenCalledTimes(1);
  });

  it("updates product and deletes old image from R2 when image changes", async () => {
    storeMocks.findProductById.mockResolvedValue(baseProduct);
    storeMocks.updateProductById.mockResolvedValue({
      ...baseProduct,
      imageUrl: "https://cdn.example.com/products/new-image.png",
      imageKey: "products/new-image.png",
    });

    const response = await request(app).put("/api/products/prod_1").send({
      name: "Whey",
      categoryId: "cat_1",
      price: 10,
      stock: 2,
      imageUrl: "https://cdn.example.com/products/new-image.png",
      imageKey: "products/new-image.png",
    });

    expect(response.status).toBe(200);
    expect(storeMocks.updateProductById).toHaveBeenCalledTimes(1);
    expect(r2Mocks.deleteImageFromR2ByKey).toHaveBeenCalledWith("products/old-image.png");
  });

  it("deletes product and cleans image from R2", async () => {
    storeMocks.findProductById.mockResolvedValue(baseProduct);
    storeMocks.deleteProductById.mockResolvedValue(true);

    const response = await request(app).delete("/api/products/prod_1");

    expect(response.status).toBe(204);
    expect(storeMocks.deleteProductById).toHaveBeenCalledWith("prod_1");
    expect(r2Mocks.deleteImageFromR2ByKey).toHaveBeenCalledWith("products/old-image.png");
  });

  it("uploads lab report pdf and returns report metadata", async () => {
    r2Mocks.uploadImageToR2.mockResolvedValueOnce({
      imageUrl: "https://cdn.example.com/lab-reports/new-report.pdf",
      imageKey: "lab-reports/new-report.pdf",
    });

    const response = await request(app)
      .post("/api/admin/lab-reports/upload")
      .set("x-admin-token", ADMIN_TEST_TOKEN)
      .attach("report", Buffer.from("%PDF-1.4"), "batch-report.pdf");

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      reportUrl: "https://cdn.example.com/lab-reports/new-report.pdf",
      reportKey: "lab-reports/new-report.pdf",
    });
    expect(r2Mocks.uploadImageToR2).toHaveBeenCalledTimes(1);
  });

  it("updates lab report and deletes old report file from R2 when URL changes", async () => {
    storeMocks.findLabReportById.mockResolvedValue(baseLabReport);
    storeMocks.updateLabReportById.mockResolvedValue({
      ...baseLabReport,
      reportUrl: "https://cdn.example.com/lab-reports/new-report.pdf",
      reportKey: "lab-reports/new-report.pdf",
    });

    const response = await request(app)
      .put("/api/admin/lab-reports/lbr_1")
      .set("x-admin-token", ADMIN_TEST_TOKEN)
      .send({
        title: "Batch Purity Report",
        reportUrl: "https://cdn.example.com/lab-reports/new-report.pdf",
        reportKey: "lab-reports/new-report.pdf",
        position: 0,
        isActive: true,
      });

    expect(response.status).toBe(200);
    expect(storeMocks.updateLabReportById).toHaveBeenCalledTimes(1);
    expect(r2Mocks.deleteImageFromR2ByKey).toHaveBeenCalledWith("lab-reports/old-report.pdf");
  });

  it("deletes lab report and cleans report file from R2", async () => {
    storeMocks.findLabReportById.mockResolvedValue(baseLabReport);
    storeMocks.deleteLabReportById.mockResolvedValue(true);

    const response = await request(app)
      .delete("/api/admin/lab-reports/lbr_1")
      .set("x-admin-token", ADMIN_TEST_TOKEN);

    expect(response.status).toBe(204);
    expect(storeMocks.deleteLabReportById).toHaveBeenCalledWith("lbr_1");
    expect(r2Mocks.deleteImageFromR2ByKey).toHaveBeenCalledWith("lab-reports/old-report.pdf");
  });

  it("creates carousel image entry", async () => {
    const response = await request(app).post("/api/carousel-images").send({
      title: "Hero 1",
      imageUrl: "https://cdn.example.com/carousel/new-image.png",
      imageKey: "carousel/new-image.png",
      sortOrder: 1,
      isActive: true,
    });

    expect(response.status).toBe(201);
    expect(storeMocks.createCarouselImage).toHaveBeenCalledTimes(1);
  });

  it("creates cart session and returns cart", async () => {
    const response = await request(app).post("/api/cart/session").send({});

    expect(response.status).toBe(201);
    expect(response.body.customerRef).toBeTruthy();
    expect(storeMocks.getOrCreateActiveCart).toHaveBeenCalledTimes(1);
  });

  it("adds item to cart for customer reference", async () => {
    const response = await request(app)
      .post("/api/cart/items")
      .set("Authorization", "Bearer auth_1")
      .send({
        productId: "prod_1",
        quantity: 2,
      });

    expect(response.status).toBe(201);
    expect(storeMocks.addItemToCart).toHaveBeenCalledWith({
      customerRef: "usr_1",
      productId: "prod_1",
      quantity: 2,
    });
  });

  it("creates checkout order from cart", async () => {
    const response = await request(app)
      .post("/api/checkout")
      .set("Authorization", "Bearer auth_1")
      .send({
        customerRef: "guest_1",
        customerName: "Moiz Khan",
        customerEmail: "moiz@example.com",
        customerPhone: "9999999999",
        shippingAddress: {
          line1: "Street 1",
          city: "Delhi",
        },
        paymentMethod: "cod",
      });

    expect(response.status).toBe(201);
    expect(response.body.order.id).toBe("ord_1");
    expect(storeMocks.createOrderFromCart).toHaveBeenCalledTimes(1);
  });
});
