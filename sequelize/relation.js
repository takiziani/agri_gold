import User from "./schemas/user.js";
import Field from "./schemas/field.js";

// Define associations
User.hasMany(Field, { foreignKey: 'id_user' });
Field.belongsTo(User, { foreignKey: 'id_user' });
export { User, Field };