import { DataTypes } from 'sequelize';
import sequelize from '../config.js';

const PredictHistoryInput = sequelize.define('PredictHistoryInput', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'Users',
            key: 'id_user'
        }
    },
    // Environmental parameters
    nitrogen: {
        type: DataTypes.FLOAT,
        allowNull: false
    },
    phosphorus: {
        type: DataTypes.FLOAT,
        allowNull: false
    },
    potassium: {
        type: DataTypes.FLOAT,
        allowNull: false
    },
    temperature: {
        type: DataTypes.FLOAT,
        allowNull: false
    },
    humidity: {
        type: DataTypes.FLOAT,
        allowNull: false
    },
    ph: {
        type: DataTypes.FLOAT,
        allowNull: false
    },
    rainfall: {
        type: DataTypes.FLOAT,
        allowNull: false
    },
    state: {
        type: DataTypes.STRING,
        allowNull: false
    },
    season: {
        type: DataTypes.STRING,
        allowNull: false
    },
    // Optional parameters
    crop_year: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    annual_rainfall: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    fertilizer: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    pesticide: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    area_hectares: {
        type: DataTypes.FLOAT,
        allowNull: true
    }
}, {
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    tableName: 'predict_history_inputs'
});

export default PredictHistoryInput;
