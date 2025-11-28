import { DataTypes } from 'sequelize';
import sequelize from '../config.js';

const SearchCache = sequelize.define('SearchCache', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    query_hash: {
        type: DataTypes.STRING(64),
        allowNull: false,
        unique: true,
        comment: 'MD5/SHA256 hash of normalized query'
    },
    original_query: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    search_results: {
        type: DataTypes.JSON,
        allowNull: false,
        comment: 'Cached search API response'
    },
    created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    expires_at: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: 'TTL based on query type'
    },
    hit_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    }
}, {
    timestamps: false,
    tableName: 'search_cache',
    indexes: [
        {
            name: 'idx_query_lookup',
            fields: ['query_hash']
        },
        {
            name: 'idx_expiration',
            fields: ['expires_at']
        }
    ]
});

export default SearchCache;
