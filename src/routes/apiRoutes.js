import { Router } from "express";
import categoriesRoutes from "./categoriesRoutes.js";
import carouselRoutes from "./carouselRoutes.js";
import customerAuthRoutes from "./customerAuthRoutes.js";
import healthRoutes from "./healthRoutes.js";
import homepageProductsRoutes from "./homepageProductsRoutes.js";
import levelsRoutes from "./levelsRoutes.js";
import mediaRoutes from "./mediaRoutes.js";
import offersRoutes from "./offersRoutes.js";
import ordersAndCartRoutes from "./ordersAndCartRoutes.js";
import paymentsRoutes from "./paymentsRoutes.js";
import productsRoutes from "./productsRoutes.js";
import publicCatalogRoutes from "./publicCatalogRoutes.js";
import adminReviewsRoutes from "./adminReviewsRoutes.js";
import announcementsRoutes from "./announcementsRoutes.js";
import publicReviewsRoutes from "./publicReviewsRoutes.js";

const app = Router();

app.use(healthRoutes);
app.use(mediaRoutes);
app.use(categoriesRoutes);
app.use(levelsRoutes);
app.use(offersRoutes);
app.use(publicCatalogRoutes);
app.use(homepageProductsRoutes);
app.use(carouselRoutes);
app.use(productsRoutes);
app.use(customerAuthRoutes);
app.use(paymentsRoutes);
app.use(ordersAndCartRoutes);
app.use(adminReviewsRoutes);
app.use(announcementsRoutes);
app.use(publicReviewsRoutes);

export default app;
