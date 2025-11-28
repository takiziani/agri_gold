import { DataTypes } from 'sequelize';
import sequelize from '../config.js';
const Field = sequelize.define("field", {
    id_field: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    latetude: {
        type: DataTypes.ARRAY(DataTypes.FLOAT),
        allowNull: false
    },
    longitude: {
        type: DataTypes.ARRAY(DataTypes.FLOAT),
        allowNull: false
    },
    area: {
        type: DataTypes.FLOAT,
        allowNull: false
    },
    id_user: {
        type: DataTypes.INTEGER,
        allowNull: false
    }
});
export default Field;