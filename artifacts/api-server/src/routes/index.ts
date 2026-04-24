// TASK 1+4+5 — Updated router: adds push (WhatsApp) + display (TV board) routes
import { Router, type IRouter } from "express";
import healthRouter    from "./health";
import stallsRouter    from "./stalls";
import ordersRouter    from "./orders";
import analyticsRouter from "./analytics";
import vendorRouter    from "./vendor";
import pushRouter      from "./push";     // TASK 4
import displayRouter   from "./display";  // TASK 5

const router: IRouter = Router();

router.use(healthRouter);
router.use(vendorRouter);      // DO NOT MODIFY — vendor OTP login preserved
router.use(stallsRouter);
router.use(ordersRouter);
router.use(analyticsRouter);
router.use(pushRouter);        // TASK 4: /api/push/whatsapp-register
router.use(displayRouter);     // TASK 5: /api/display/:stallId

export default router;
