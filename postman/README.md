# AgriBot Chatbot API - Postman Collection

## 📚 Overview
This Postman collection contains all endpoints for the **simplified** AgriBot Chatbot API.

## 🚀 Quick Start

1. **Import Collection**:
   - Open Postman
   - Click **Import**
   - Select `AgriBot_Chatbot_API.postman_collection.json`

2. **Set Base URL**:
   - Collection variable: `base_url = http://localhost:3000`

3. **Run Migration** (first time only):
   ```bash
   node migrate.js
   ```

4. **Start Server**:
   ```bash
   npm run start:dev
   ```

## 📡 API Endpoints

### 1. Health Check
**GET** `/api/chatbot/health`

Check if the API is operational.

**Response**:
```json
{
  "success": true,
  "service": "AgriBot Chatbot API (Simplified)",
  "status": "operational",
  "version": "2.0"
}
```

---

### 2. Send Message
**POST** `/api/chatbot/message`

Send a message and get AI response. Creates chat if it doesn't exist.

**Request**:
```json
{
  "user_id": 1,
  "message": "What crops should I plant?"
}
```

**Response**:
```json
{
  "success": true,
  "chatId": 5,
  "userMessage": {
    "id": 10,
    "text": "What crops should I plant?",
    "timestamp": "2024-11-28T18:00:00Z"
  },
  "botMessage": {
    "id": 11,
    "text": "Based on your soil data...",
    "timestamp": "2024-11-28T18:00:02Z"
  },
  "intent": "crop_advice",
  "confidence": 0.85,
  "sources": [],
  "searchPerformed": false,
  "userContextUsed": true
}
```

---

### 3. Get Messages (Latest)
**GET** `/api/chatbot/:userId/messages?limit=50`

Get latest messages from user's chat (newest first).

**Query Parameters**:
- `limit` (optional): Number of messages (default: 50, max: 100)

**Response**:
```json
{
  "success": true,
  "chatId": 5,
  "messages": [
    {
      "id": 11,
      "text": "Based on your soil...",
      "isUser": false,
      "timestamp": "2024-11-28T18:00:02Z"
    },
    {
      "id": 10,
      "text": "What crops should I plant?",
      "isUser": true,
      "timestamp": "2024-11-28T18:00:00Z"
    }
  ],
  "pagination": {
    "hasMore": true,
    "nextCursor": 9,
    "total": 50
  }
}
```

---

### 4. Get Messages (Pagination)
**GET** `/api/chatbot/:userId/messages?limit=20&before=100`

Load older messages using cursor pagination.

**Query Parameters**:
- `limit`: Number of messages
- `before`: Message ID (get messages older than this)

**Response**: Same as "Get Messages (Latest)"

---

### 5. Delete Chat
**DELETE** `/api/chatbot/:userId/chat`

Delete user's chat and all messages (GDPR compliance).

**Response**:
```json
{
  "success": true,
  "message": "Chat deleted successfully"
}
```

---

## 🧪 Testing Workflow

1. **Health Check** → Verify API is running
2. **Send Message (First Time)** → Creates chat for user
3. **Send Message (Continue)** → Adds to existing chat
4. **Get Messages** → View conversation history
5. **Get Messages (Pagination)** → Load older messages
6. **Delete Chat** → Clean up (optional)

## 📝 Notes

- **No Session Management**: One continuous chat per user
- **Cursor Pagination**: Use `nextCursor` from response as `before` parameter
- **Order**: Messages returned newest first
- **Test Users**: 1, 2, 3 (with different contexts)
- **Languages**: Supports English, French, Arabic/Darja

## 🔗 Related Files

- API Routes: `routes/chatbot.js`
- Service Logic: `services/chatbotService.js`
- Database Schemas: `sequelize/schemas/chat.js`, `sequelize/schemas/message.js`
