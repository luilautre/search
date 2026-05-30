import { Router, type IRouter } from "express";
import healthRouter from "./health";
import steamRouter from "./steam";

const router: IRouter = Router();

router.use(healthRouter);
router.use(steamRouter);

export default router;
