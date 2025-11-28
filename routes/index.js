import { Router } from "express";
import usersRouter from './users.js';
import analyseRouter from './analyse.js';
const router = Router();
router.use(usersRouter);
router.use(analyseRouter);
export default router;