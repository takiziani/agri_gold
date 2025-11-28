import User from "./schemas/user.js";
import Field from "./schemas/field.js";
import PredictHistoryInput from "./schemas/predict_history_input.js";
import PredictHistoryOutput from "./schemas/predict_history_output.js";
import Notification from "./schemas/notification.js";

// Define associations

// User -> Field (one-to-many)
User.hasMany(Field, { foreignKey: 'id_user' });
Field.belongsTo(User, { foreignKey: 'id_user' });

// User -> PredictHistoryInput (one-to-many)
User.hasMany(PredictHistoryInput, { foreignKey: 'user_id', as: 'predictionInputs' });
PredictHistoryInput.belongsTo(User, { foreignKey: 'user_id' });

// PredictHistoryInput -> PredictHistoryOutput (one-to-many)
PredictHistoryInput.hasMany(PredictHistoryOutput, { foreignKey: 'input_id', as: 'predictions' });
PredictHistoryOutput.belongsTo(PredictHistoryInput, { foreignKey: 'input_id' });

// User -> Notification (one-to-many)
User.hasMany(Notification, { foreignKey: 'user_id', as: 'notifications' });
Notification.belongsTo(User, { foreignKey: 'user_id' });

// PredictHistoryOutput -> Notification (one-to-many)
PredictHistoryOutput.hasMany(Notification, { foreignKey: 'output_id', as: 'notifications' });
Notification.belongsTo(PredictHistoryOutput, { foreignKey: 'output_id' });

export { User, Field, PredictHistoryInput, PredictHistoryOutput, Notification };