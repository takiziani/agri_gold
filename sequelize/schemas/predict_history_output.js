import { DataTypes } from 'sequelize';
import sequelize from '../config.js';

const PredictHistoryOutput = sequelize.define('PredictHistoryOutput', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    input_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'predict_history_inputs',
            key: 'id'
        }
    },
    // Main prediction (used in notification)
    best_crop: {
        type: DataTypes.STRING,
        allowNull: false
    },
    predicted_yield: {
        type: DataTypes.FLOAT,
        allowNull: false
    },
    unit: {
        type: DataTypes.STRING,
        allowNull: false
    },
    region: {
        type: DataTypes.STRING,
        allowNull: false
    },
    // Recommendation block (optional)
    recommendation_basis: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    ranking: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    selection_criteria: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    suitable_for: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    // Revenue block (prices saved here)
    price_per_ton: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    revenue_per_hectare: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    total_area_hectares: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    total_yield_tons: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    total_revenue: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    currency: {
        type: DataTypes.STRING(3),
        allowNull: true,
        defaultValue: 'DZD'
    },
    // Alternative crops (stored as JSON)
    alternative_crops: {
        type: DataTypes.JSON,
        allowNull: true
    }
}, {
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    tableName: 'predict_history_outputs'
});

export default PredictHistoryOutput;
