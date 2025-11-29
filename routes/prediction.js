import { Router } from "express";
import verifyjwt from "../utils/jwt.js";
import { Prediction } from "../sequelize/relation.js";
const router = Router();
router.use(verifyjwt);

router.get("/prediction", async (request, response) => {
    try {
        const userId = request.userid;
        const predictions = await Prediction.findAll({ where: { id_user: userId }, order: [['created_at', 'DESC']] });
        response.json({ predictions: predictions });
    } catch (error) {
        response.status(400).json({ error: error.message });
    }
});
router.get("/prediction/:id", async (request, response) => {
    try {
        const userId = request.userid;
        const predictionId = request.params.id;
        const prediction = await Prediction.findOne({ where: { id_user: userId, id_prediction: predictionId } });
        response.json({ prediction: prediction });
    } catch (error) {
        response.status(400).json({ error: error.message });
    }
});
router.delete("/prediction/:id", async (request, response) => {
    try {
        const userId = request.userid;
        const predictionId = request.params.id;
        const deleteCount = await Prediction.destroy({ where: { id_user: userId, id_prediction: predictionId } });
        response.json({ massage: "the prediction is deleted" });
    } catch (error) {
        response.status(400).json({ error: error.message });
    }
});
export default router;