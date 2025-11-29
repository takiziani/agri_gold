import User from "./schemas/user.js";
import Field from "./schemas/field.js";
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


// User -> Notification (one-to-many)
User.hasMany(Notification, { foreignKey: 'user_id', as: 'notifications' });
Notification.belongsTo(User, { foreignKey: 'user_id' });

// Prediction -> Notification (one-to-many)
Prediction.hasMany(Notification, { foreignKey: 'prediction_id', as: 'notifications' });
Notification.belongsTo(Prediction, { foreignKey: 'prediction_id' });

// User -> Chat (one-to-one)
User.hasOne(Chat, { foreignKey: 'user_id', as: 'chat' });
Chat.belongsTo(User, { foreignKey: 'user_id' });

// Chat -> Message (one-to-many)
Chat.hasMany(Message, { foreignKey: 'chat_id', as: 'messages' });
Message.belongsTo(Chat, { foreignKey: 'chat_id' });

// User -> UserContextCache (one-to-one)
User.hasOne(UserContextCache, { foreignKey: 'user_id', as: 'contextCache' });
UserContextCache.belongsTo(User, { foreignKey: 'user_id' });
Field.hasMany(Prediction, { foreignKey: 'id_field' });
Prediction.belongsTo(Field, { foreignKey: 'id_field' });
User.hasMany(Prediction, { foreignKey: 'id_user' });
Prediction.belongsTo(User, { foreignKey: 'id_user' });
export {
    User,
    Field,
    Notification,
    Chat,
    Message,
    UserContextCache,
    SearchCache,
    Prediction
};