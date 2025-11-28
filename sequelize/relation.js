import User from "./schemas/user.js";
import Field from "./schemas/field.js";
import PredictHistoryInput from "./schemas/predict_history_input.js";
import PredictHistoryOutput from "./schemas/predict_history_output.js";
import Notification from "./schemas/notification.js";
import Chat from "./schemas/chat.js";
import Message from "./schemas/message.js";
import UserContextCache from "./schemas/user_context_cache.js";
import SearchCache from "./schemas/search_cache.js";

import Prediction from "./schemas/prediction.js";
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

// User -> Chat (one-to-one)
User.hasOne(Chat, { foreignKey: 'user_id', as: 'chat' });
Chat.belongsTo(User, { foreignKey: 'user_id' });

// Chat -> Message (one-to-many)
Chat.hasMany(Message, { foreignKey: 'chat_id', as: 'messages' });
Message.belongsTo(Chat, { foreignKey: 'chat_id' });

// User -> UserContextCache (one-to-one)
User.hasOne(UserContextCache, { foreignKey: 'user_id', as: 'contextCache' });
UserContextCache.belongsTo(User, { foreignKey: 'user_id' });

export {
    User,
    Field,
    PredictHistoryInput,
    PredictHistoryOutput,
    Notification,
    Chat,
    Message,
    UserContextCache,
    SearchCache
};
Field.hasMany(Prediction, { foreignKey: 'id_field' });
Prediction.belongsTo(Field, { foreignKey: 'id_field' });
User.hasMany(Prediction, { foreignKey: 'id_user' });
Prediction.belongsTo(User, { foreignKey: 'id_user' });
export { User, Field, Prediction };
