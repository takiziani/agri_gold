import { User } from "../sequelize/relation.js";
import { Router } from "express";
import { hashPassword, comparePassword } from "../utils/helper.js";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import verifyjwt from "../utils/jwt.js";
dotenv.config();
const router = Router();
router.post("/users/register", async (request, response) => {
    try {
        const user = request.body;
        user.password = hashPassword(user.password);
        const newuser = await User.create(user);
        if (!newuser) {
            return response.status(400).json({ error: "User creation failed" });
        }
        response.json({ message: "User created " });
    } catch (error) {
        response.status(400).json({ error: error.errors[0].message });// Adjusted to provide more specific error message
    }
});
router.post("/mobile/login", async (request, response) => {
    try {
        const { email, password } = request.body;
        const user = await User.findOne({
            where: {
                email: email
            },
            attributes: ["password", "id_user", "refresh_token",]
        });
        if (!user) {
            return response.status(404).json({ error: "User not found" });
        }
        const isPasswordValid = comparePassword(password, user.password);
        if (!isPasswordValid) {
            return response.status(400).json({ error: "User not found" });
        }
        const accessToken = jwt.sign({ "id": user.id_user }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "1min" });
        if (!user.refresh_token) {
            const refreshToken = jwt.sign({ "id": user.id_user }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: "7d" });
            user.refresh_token = refreshToken;
        } else {
            try {
                jwt.verify(user.refresh_token, process.env.REFRESH_TOKEN_SECRET);
            } catch (error) {
                const refreshToken = jwt.sign({ "id": user.id_user }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: "7d" });
                user.refresh_token = refreshToken;
            }
        }
        await user.save();
        response.json({
            user: user.username,
            accessToken,
            refreshToken: user.refresh_token
        });
    } catch (error) {
        response.status(400).json({ error: error.message });
    }
});
router.get("/users/me", verifyjwt, async (request, response) => {
    try {
        const userid = request.userid;
        const user = await User.findByPk(userid, {
            attributes: { exclude: ["password", "refresh_token"] }
        });
        if (!user) {
            return response.status(404).json({ error: "User not found" });
        }
        response.json(user);
    } catch (error) {
        response.status(400).json({ error: error.message });
    }
});
router.post("/users/logout", verifyjwt, async (request, response) => {
    try {
        const userid = request.userid;
        const user = await User.findByPk(userid);
        if (!user) {
            return response.status(404).json({ error: "User not found" });
        }
        user.refresh_token = null;
        await user.save();
        response.json({ message: "Logged out successfully" });
    } catch (error) {
        response.status(400).json({ error: error.message });
    }
});
router.post("/mobile/refresh", async (request, response) => {
    try {
        const refreshToken = request.body.refreshToken;
        if (!refreshToken) {
            return response.status(401).json({ error: "Refresh token not found" });
        }
        let payload;
        payload = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
        const user = await User.findOne({ where: { id_user: payload.id } });
        if (!user || user.refresh_token !== refreshToken) {
            return response.status(401).json({ error: "Invalid refresh token" });
        }
        const accessToken = jwt.sign({ "id": user.id_user }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "1min" });
        response.json({ accessToken });
    } catch (error) {
        return response.status(401).json({ error: error.message });
    }
});
router.patch("/users/update", verifyjwt, async (request, response) => {
    try {
        const id = request.userid;
        const user = request.body;
        const userprevious = await User.findOne({
            where: { id_user: id },
            attributes: { exclude: ['password', 'refresh_token'] }
        });
        if (userprevious) {
            if (user.email) {
                userprevious.email = user.email;
            }
        }
        await userprevious.save();
        response.json({ message: "User updated", user: userprevious });
    } catch (error) {
        response.status(400).json({ error: error.message });
    }
});
export default router;