import { DataTypes } from 'sequelize';
import sequelize from '../config.js';

const ChatSession = sequelize.define('ChatSession', {
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
    started_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    ended_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'active',
        validate: {
            isIn: [['active', 'closed', 'abandoned']]
        }
    },
    session_summary: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    total_messages: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    // Metadata
    device_type: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    user_location: {
        type: DataTypes.JSON,
        allowNull: true
    }
}, {
    timestamps: false,
    tableName: 'chat_sessions',
    indexes: [
        {
            name: 'idx_user_sessions',
            fields: ['user_id', 'started_at']
        },
        {
            name: 'idx_active_sessions',
            fields: ['status', 'started_at']
        }
    ]
});

export default ChatSession;
