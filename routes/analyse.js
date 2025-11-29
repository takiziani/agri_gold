import { Router } from "express";
import verifyjwt from "../utils/jwt.js";
import { Field, Prediction } from "../sequelize/relation.js";
import fetch from "node-fetch";
import dotenv from "dotenv";
import main from "../utils/gemini.js";
dotenv.config();
const router = Router();
// Removed global middleware - apply per route instead
router.post("/field/add", verifyjwt, async (request, response) => {
    try {
        const userId = request.userid;
        const { name, latetude, longitude, area } = request.body;
        const newField = await Field.create({
            name: name,
            latetude: latetude,
            longitude: longitude,
            area: area,
            id_user: userId
        });
        response.json({ message: "Field added successfully", field: newField });
    } catch (error) {
        response.status(400).json({ error: error.message });
    }
});
router.get("/field/analyse/:id", verifyjwt, async (request, response) => {
    try {
        const userId = request.userid;
        const fieldId = request.params.id;
        const field = await Field.findOne({ where: { id_field: fieldId, id_user: userId } });
        if (!field) {
            return response.status(404).json({ error: "Field not found" });
        }
        const latitudes = field.latetude;
        const longitudes = field.longitude;
        if (!latitudes || latitudes.length === 0 || !longitudes || longitudes.length === 0) {
            return response.status(400).json({ error: "Field coordinates are missing or invalid" });
        }
        const latSum = latitudes.reduce((a, b) => a + b, 0);
        const lonSum = longitudes.reduce((a, b) => a + b, 0);
        const latAvg = latSum / latitudes.length;
        const lonAvg = lonSum / longitudes.length;
        const url = `https://rest.isric.org/soilgrids/v2.0/properties/query?lat=${latAvg}&lon=${lonAvg}&property=nitrogen&property=cec&property=sand&depth=0-5cm&value=mean&property=phh2o`;
        const res = await fetch(url);
        if (!res.ok) {
            return response.status(500).json({ error: "Failed to fetch soil data from external API" });
        }
        const data = await res.json();
        if (!data.properties || !data.properties.layers) {
            return response.status(500).json({ error: "Invalid data received from soil API" });
        }
        const layers = data.properties.layers;
        let cec_raw = null;
        let nitrogen_raw = null;
        let ph = null;
        layers.forEach(layer => {
            if (layer.name === "cec") {
                cec_raw = layer.depths[0].values.mean / layer.unit_measure.d_factor;
            }
            if (layer.name === "nitrogen") {
                nitrogen_raw = layer.depths[0].values.mean / layer.unit_measure.d_factor;
            }
            if (layer.name === "phh2o") {
                ph = layer.depths[0].values.mean / layer.unit_measure.d_factor;
            }
        });
        //N
        const total_N = nitrogen_raw; // g/kg
        const available_N = total_N * 0.1;
        //K
        const available_K = 2.5 * cec_raw;
        //P requires pH
        let available_P = null;
        if (ph != null) {
            available_P = 4 + (0.3 * cec_raw) - (0.5 * ph);
        }
        response.json({
            field_id: field.id_field,
            field_name: field.name,
            coordinates: {
                center_latitude: latAvg,
                center_longitude: lonAvg
            },
            soil_properties: {
                cec: {
                    value: cec_raw,
                    unit: "cmol(c)/kg",
                    description: "Cation Exchange Capacity"
                },
                nitrogen: {
                    total: total_N,
                    available: available_N,
                    unit: "g/kg"
                },
                potassium: {
                    available: available_K,
                    unit: "mg/kg"
                },
                phosphorus: available_P ? {
                    available: available_P,
                    unit: "mg/kg"
                } : null,
                ph: ph ? {
                    value: ph,
                    description: "pH in H2O"
                } : null
            }
        });
    } catch (error) {
        response.status(400).json({ error: error.message });
    }
});
router.get("/field", verifyjwt, async (request, response) => {
    try {
        const userId = request.userid;
        const fields = await Field.findAll({ where: { id_user: userId } });
        response.json({ fields: fields });
    } catch (error) {
        response.status(400).json({ error: error.message });
    }
});
router.get("/field/:id", verifyjwt, async (request, response) => {
    try {
        const userId = request.userid;
        const fieldId = request.params.id;
        const field = await Field.findOne({
            where: {
                id_field: fieldId,
                id_user: userId
            },
            include: {
                model: Prediction,
                foreignKey: 'id_field'
            }
        });
        if (!field) {
            return response.status(404).json({ error: "Field not found" });
        }
        response.json({ field: field });
    } catch (error) {
        response.status(400).json({ error: error.message });
    }
});
router.patch("/field/:id", verifyjwt, async (request, response) => {
    try {
        const userId = request.userid;
        const fieldId = request.params.id;
        const { name, latetude, longitude } = request.body;
        const field = await Field.findOne({ where: { id_field: fieldId, id_user: userId } });
        if (!field) {
            return response.status(404).json({ error: "Field not found" });
        }
        field.name = name || field.name;
        field.latetude = latetude || field.latetude;
        field.longitude = longitude || field.longitude;
        await field.save();
        response.json({ message: "Field updated successfully", field: field });
    } catch (error) {
        response.status(400).json({ error: error.message });
    }
});
router.delete("/field/:id", verifyjwt, async (request, response) => {
    try {
        const userId = request.userid;
        const fieldId = request.params.id;
        const field = await Field.findOne({ where: { id_field: fieldId, id_user: userId } });
        if (!field) {
            return response.status(404).json({ error: "Field not found" });
        }
        await field.destroy();
        response.json({ message: "Field deleted successfully" });
    } catch (error) {
        response.status(400).json({ error: error.message });
    }
});
router.get("/field/fullanalyse/:id", async (request, response) => {
    try {
        const userId = request.userid;
        const fieldId = request.params.id;
        const field = await Field.findOne({ where: { id_field: fieldId, /*id_user: userId*/ } });
        if (!field) {
            return response.status(404).json({ error: "Field not found" });
        }
        const latitudes = field.latetude;
        const longitudes = field.longitude;
        if (!latitudes || latitudes.length === 0 || !longitudes || longitudes.length === 0) {
            return response.status(400).json({ error: "Field coordinates are missing or invalid" });
        }
        const latSum = latitudes.reduce((a, b) => a + b, 0);
        const lonSum = longitudes.reduce((a, b) => a + b, 0);
        const latAvg = latSum / latitudes.length;
        const lonAvg = lonSum / longitudes.length;
        const stateUrl = `https://nominatim.openstreetmap.org/reverse?lat=${latAvg}&lon=${lonAvg}&format=json`;

        const stateRes = await fetch(stateUrl, {
            headers: {
                "User-Agent": "MyApp/1.0 (takizia36@gmail.com)", // REQUIRED
                "Accept-Language": "en"
            }
        });
        console.log(stateRes);
        if (!stateRes.ok) {
            return response.status(500).json({
                error: "Failed to fetch location data from external API"
            });
        }
        const stateData = await stateRes.json();
        const state = stateData.address.state || "Unknown";
        // Function to determine season based on current date
        const getCurrentSeason = () => {
            const now = new Date();
            const month = now.getMonth(); // 0-11 (January is 0)

            if (month >= 2 && month <= 4) {
                return "Rabi";
            } else if (month >= 5 && month <= 7) {
                return "Summer";
            } else if (month >= 8 && month <= 10) {
                return "Autumn";
            } else {
                return "Winter";
            }
        };
        const season = getCurrentSeason();
        // Soil Data Fetching
        const soilUrl = `https://rest.isric.org/soilgrids/v2.0/properties/query?lat=${latAvg}&lon=${lonAvg}&property=nitrogen&property=cec&property=sand&depth=0-5cm&value=mean&property=phh2o`;
        const soilRes = await fetch(soilUrl);
        if (!soilRes.ok) {
            return response.status(500).json({ error: "Failed to fetch soil data from external API" });
        }
        const soilData = await soilRes.json();
        if (!soilData.properties || !soilData.properties.layers) {
            return response.status(500).json({ error: "Invalid data received from soil API" });
        }
        const layers = soilData.properties.layers;
        let cec_raw = null;
        let nitrogen_raw = null;
        let ph = null;
        layers.forEach(layer => {
            if (layer.name === "cec") {
                cec_raw = layer.depths[0].values.mean / layer.unit_measure.d_factor;
            }
            if (layer.name === "nitrogen") {
                nitrogen_raw = layer.depths[0].values.mean / layer.unit_measure.d_factor;
            }
            if (layer.name === "phh2o") {
                ph = layer.depths[0].values.mean / layer.unit_measure.d_factor;
            }
        });
        //N
        const total_N = nitrogen_raw; // g/kg
        //K
        const available_K = 2.5 * cec_raw;
        //P requires pH
        let available_P = null;
        if (ph != null) {
            available_P = 4 + (0.3 * cec_raw) - (0.5 * ph);
        }
        // Weather Data Fetching
        const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${latAvg}&lon=${lonAvg}&appid=${process.env.OpenWhether}&units=metric`;
        const weatherRes = await fetch(weatherUrl);
        if (!weatherRes.ok) {
            return response.status(500).json({ error: "Failed to fetch weather data from external API" });
        }
        const weatherData = await weatherRes.json();
        const analysisUrl = `https://agro-tech-clsx.onrender.com/api/full_analysis`;
        const analysisRes = await fetch(analysisUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                Temperature: weatherData.main.temp.toString(),
                Humidity: weatherData.main.humidity.toString(),
                Nitrogen: total_N ? total_N.toFixed(2) : "0",
                Potassium: available_K ? available_K.toFixed(2) : "0",
                Phosphorus: available_P ? available_P.toFixed(2) : "0",
                Ph: ph ? ph.toFixed(1) : "7",
                Rainfall: "10",
                state: state,
                season: season
            })
        });
        if (!analysisRes.ok) {
            return response.status(500).json({ error: "Failed to fetch crop analysis from external API" });
        }
        const analysisData = await analysisRes.json();
        const mainData = {
            bestCrops: analysisData.alternative_crops,
            soil: analysisData.soil_parameters,
        }
        const text = await main(mainData);
        const prediction = await Prediction.create({
            id_field: field.id_field,
            prediction_date: new Date(),
            bestCrops: mainData.bestCrops,
            soil: mainData.soil,
            aiExplain: text,
            id_user: userId
        });
        response.json({ prediction });
    } catch (error) {
        response.status(400).json({ error: error.message });
    }
});
router.get("/field/fullanalyse/cardinality", async (request, response) => {
    try {
        const { latitude, longitude } = request.query;

        if (!latitude || !longitude) {
            return response.status(400).json({ error: "Latitude and longitude are required" });
        }

        const latAvg = parseFloat(latitude);
        const lonAvg = parseFloat(longitude);

        if (isNaN(latAvg) || isNaN(lonAvg)) {
            return response.status(400).json({ error: "Invalid latitude or longitude format" });
        }

        const stateurl = `https://nominatim.openstreetmap.org/reverse?lat=${latAvg}&lon=${lonAvg}&format=json`;
        const stateRes = await fetch(stateurl);
        if (!stateRes.ok) {
            return response.status(500).json({ error: "Failed to fetch location data from external API" });
        }
        const stateData = await stateRes.json();
        const state = stateData.address.state || "Unknown";

        // Function to determine season based on current date
        const getCurrentSeason = () => {
            const now = new Date();
            const month = now.getMonth(); // 0-11 (January is 0)

            if (month >= 2 && month <= 4) {
                return "Rabi";
            } else if (month >= 5 && month <= 7) {
                return "Summer";
            } else if (month >= 8 && month <= 10) {
                return "Autumn";
            } else {
                return "Winter";
            }
        };
        const season = getCurrentSeason();

        // Soil Data Fetching
        const soilUrl = `https://rest.isric.org/soilgrids/v2.0/properties/query?lat=${latAvg}&lon=${lonAvg}&property=nitrogen&property=cec&property=sand&depth=0-5cm&value=mean&property=phh2o`;
        const soilRes = await fetch(soilUrl);
        if (!soilRes.ok) {
            return response.status(500).json({ error: "Failed to fetch soil data from external API" });
        }
        const soilData = await soilRes.json();
        if (!soilData.properties || !soilData.properties.layers) {
            return response.status(500).json({ error: "Invalid data received from soil API" });
        }

        const layers = soilData.properties.layers;
        let cec_raw = null;
        let nitrogen_raw = null;
        let ph = null;
        layers.forEach(layer => {
            if (layer.name === "cec") {
                cec_raw = layer.depths[0].values.mean / layer.unit_measure.d_factor;
            }
            if (layer.name === "nitrogen") {
                nitrogen_raw = layer.depths[0].values.mean / layer.unit_measure.d_factor;
            }
            if (layer.name === "phh2o") {
                ph = layer.depths[0].values.mean / layer.unit_measure.d_factor;
            }
        });

        //N
        const total_N = nitrogen_raw; // g/kg
        //K
        const available_K = 2.5 * cec_raw;
        //P requires pH
        let available_P = null;
        if (ph != null) {
            available_P = 4 + (0.3 * cec_raw) - (0.5 * ph);
        }

        // Weather Data Fetching
        const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${latAvg}&lon=${lonAvg}&appid=${process.env.OpenWhether}&units=metric`;
        const weatherRes = await fetch(weatherUrl);
        if (!weatherRes.ok) {
            return response.status(500).json({ error: "Failed to fetch weather data from external API" });
        }
        const weatherData = await weatherRes.json();

        const analysisUrl = `https://agro-tech-clsx.onrender.com/api/full_analysis`;
        const analysisRes = await fetch(analysisUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                Temperature: weatherData.main.temp.toString(),
                Humidity: weatherData.main.humidity.toString(),
                Nitrogen: total_N ? total_N.toFixed(2) : "0",
                Potassium: available_K ? available_K.toFixed(2) : "0",
                Phosphorus: available_P ? available_P.toFixed(2) : "0",
                Ph: ph ? ph.toFixed(1) : "7",
                Rainfall: "10",
                state: state,
                season: season
            })
        });

        if (!analysisRes.ok) {
            return response.status(500).json({ error: "Failed to fetch crop analysis from external API" });
        }

        const analysisData = await analysisRes.json();
        const mainData = {
            bestCrops: analysisData.alternative_crops,
            soil: analysisData.soil_parameters,
        }
        const text = await main(mainData);

        response.json({
            coordinates: {
                latitude: latAvg,
                longitude: lonAvg
            },
            location: {
                state: state,
                season: season
            },
            mainData,
            text
        });
    } catch (error) {
        response.status(400).json({ error: error.message });
    }
});
router.get("/field/analyse/weather/:id", async (request, response) => {
    try {
        const userId = request.userid;
        const fieldId = request.params.id;
        const field = await Field.findOne({ where: { id_field: fieldId, /*id_user: userId*/ } });
        if (!field) {
            return response.status(404).json({ error: "Field not found" });
        }
        const latitudes = field.latetude;
        const longitudes = field.longitude;
        if (!latitudes || latitudes.length === 0 || !longitudes || longitudes.length === 0) {
            return response.status(400).json({ error: "Field coordinates are missing or invalid" });
        }
        const latSum = latitudes.reduce((a, b) => a + b, 0);
        const lonSum = longitudes.reduce((a, b) => a + b, 0);
        const latAvg = latSum / latitudes.length;
        const lonAvg = lonSum / longitudes.length;
        const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${latAvg}&lon=${lonAvg}&appid=${process.env.OpenWhether}&units=metric`;
        const weatherRes = await fetch(weatherUrl);
        if (!weatherRes.ok) {
            return response.status(500).json({ error: "Failed to fetch weather data from external API" });
        }
        const weatherData = await weatherRes.json();
        response.json({ weather: weatherData });
    } catch (error) {
        response.status(400).json({ error: error.message });
    }
});
export default router;