import { DataTypes } from 'sequelize';
import sequelize from '../config.js';
const Field = sequelize.define("prediction", {
    id_prediction: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    id_field: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    prediction_date: {
        type: DataTypes.DATE,
        allowNull: false
    },
    bestCrops: {
        type: DataTypes.ARRAY(DataTypes.JSON),
        allowNull: false
    },
    soil: {
        type: DataTypes.JSON,
        allowNull: false
    },
    aiExplain: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    id_user: {
        type: DataTypes.INTEGER,
    }
});
export default Field;