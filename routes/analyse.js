import { Router } from "express";
import verifyjwt from "../utils/jwt.js";
import { User } from "../sequelize/relation.js";
import fetch from "node-fetch";

const router = Router();
// router.use(verifyjwt);
router.get("/analyse/field", async (request, response) => {
    try {
        // const userId = request.user.id;
        const { latetude, longitude } = request.body;
        const url = `https://rest.isric.org/soilgrids/v2.0/properties/query?lat=${36.75}&lon=${3.04}`;
        const res = await fetch(url);
        const data = await res.json();
        response.json(data);
    } catch (error) {
        response.status(400).json({ error: error.message });
    }
});
export default router;