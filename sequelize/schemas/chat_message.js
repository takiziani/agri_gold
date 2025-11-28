import { DataTypes } from 'sequelize';
import sequelize from '../config.js';

const ChatMessage = sequelize.define('ChatMessage', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    session_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'chat_sessions',
            key: 'id'
        },
        onDelete: 'CASCADE'
    },
    sender_type: {
        type: DataTypes.STRING(10),
        allowNull: false,
        validate: {
            isIn: [['user', 'bot']]
        }
    },
    // Message content
    message_text: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    message_audio_url: {
        type: DataTypes.STRING(500),
        allowNull: true
    },
    // Metadata
    created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    language: {
        type: DataTypes.STRING(10),
        allowNull: false,
        defaultValue: 'darja'
    },
    // AI context
    intent: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    confidence_score: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    // Tool usage tracking
    used_web_search: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    used_user_history: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    web_sources: {
        type: DataTypes.JSON,
        allowNull: true
    },
    // Performance metrics
    response_time_ms: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    tokens_used: {
        type: DataTypes.INTEGER,
        allowNull: true
    }
}, {
    timestamps: false,
    tableName: 'chat_messages',
    indexes: [
        {
            name: 'idx_session_messages',
            fields: ['session_id', 'created_at']
        },
        {
            name: 'idx_intent_analysis',
            fields: ['intent', 'created_at']
        }
    ]
});

export default ChatMessage;
