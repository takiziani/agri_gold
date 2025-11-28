import { DataTypes } from 'sequelize';
import sequelize from '../config.js';

const UserContextCache = sequelize.define('UserContextCache', {
    user_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        allowNull: false,
        references: {
            model: 'Users',
            key: 'id_user'
        }
    },
    // Recent predictions summary (JSON for flexibility)
    recent_crops: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Array of recent crop predictions with yields and dates'
    },
    avg_soil_metrics: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Average NPK, pH, rainfall from user history'
    },
    preferred_region: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    preferred_season: {
        type: DataTypes.STRING(20),
        allowNull: true
    },
    // Conversation preferences
    preferred_language: {
        type: DataTypes.STRING(10),
        allowNull: false,
        defaultValue: 'darja'
    },
    uses_voice: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    // Cache metadata
    last_updated: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    }
}, {
    timestamps: false,
    tableName: 'user_context_cache',
    indexes: [
        {
            name: 'idx_cache_freshness',
            fields: ['last_updated']
        }
    ]
});

export default UserContextCache;
