import express from 'express';
import dotenv from 'dotenv';
import cookieParser from "cookie-parser";
import cors from "cors";
import { corsOptions } from './cors/corsoptions.js';
import { credentials } from './cors/cridentials.js';
import sequelize from './sequelize/config.js';
import portfinder from 'portfinder';
import router from './routes/index.js';

dotenv.config();
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(credentials);
app.use(cors(corsOptions));
app.use(router);

const initializeDatabase = async () => {
    try {
        await sequelize.authenticate();
        console.log('Connection has been established successfully.');
        // run migration
        await sequelize.sync({ force: false, alter: false });
        console.log('Database synchronized');
    } catch (err) {
        console.error('Unable to connect to the database:', err);
        throw err;
    }
};
const startServer = async () => {
    try {
        await initializeDatabase();
        const port = await portfinder.getPortPromise({ port: 3000, stopPort: 9000 });
        const PORT = port || 3000;
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    } catch (err) {
        console.error('Unable to start the server:', err);
    }
};
startServer();