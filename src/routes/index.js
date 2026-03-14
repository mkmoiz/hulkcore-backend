import { Router } from "express";
import apiRoutes from "./apiRoutes.js";

const router = Router();
router.use(apiRoutes);

export default router;
