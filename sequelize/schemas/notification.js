import { DataTypes } from 'sequelize';
import sequelize from '../config.js';

const Notification = sequelize.define('Notification', {
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
    prediction_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'predictions',
            key: 'id_prediction'
        }
    },
    // Snapshot of the originating prediction
    best_crop: {
        type: DataTypes.STRING,
        allowNull: false
    },
    predicted_yield: {
        type: DataTypes.FLOAT,
        allowNull: false
    },
    region: {
        type: DataTypes.STRING,
        allowNull: false
    },
    prediction_created_at: {
        type: DataTypes.DATE,
        allowNull: false
    },
    // Notification status
    is_read: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    notification_type: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'prediction_result'
    },
    title: {
        type: DataTypes.STRING,
        allowNull: true
    },
    message: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    tableName: 'notifications'
});

export default Notification;
