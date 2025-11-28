# AgriBot Chatbot API Documentation

## Overview
AgriBot is an AI-powered agricultural chatbot that provides personalized crop advice, market price information, weather forecasts, and disease management guidance for Algerian farmers.

## Base URL
```
http://localhost:3000/api/chatbot
```

---

## Endpoints

### 1. Send Message
**POST** `/message`

Send a message to the chatbot and receive an AI-generated response.

#### Request Body
```json
{
  "user_id": 123,
  "session_id": 456,  // Optional, null to create new session
  "message": "شحال تمن الطماطم اليوم؟",
  "is_voice": false,  // Optional, default: false
  "audio_url": null,  // Optional, for voice messages
  "device_type": "web",  // Optional: 'web', 'mobile'
  "user_location": {  // Optional
    "state": "Setif",
    "region": "Hauts Plateaux"
  }
}
```

#### Response
```json
{
  "success": true,
  "sessionId": 456,
  "response": {
    "text": "السلام! الطماطم اليوم في السوق بـ 60 دينار للكيلو...",
    "intent": "price_inquiry",
    "confidence": 1.0
  },
  "sources": [
    {
      "title": "Algeria Market Prices - Today",
      "url": "https://agriculture.dz/prices",
      "content": "Tomato prices updated daily..."
    }
  ],
  "searchPerformed": true,
  "userContextUsed": true,
  "metadata": {
    "totalTime": 2453,
    "aiTime": 1890,
    "tokensUsed": 487
  }
}
```

---

### 2. Get User Sessions
**GET** `/sessions/:userId?limit=20`

Retrieve a user's chat sessions.

#### Parameters
- `userId` (path): User ID
- `limit` (query): Maximum sessions to return (default: 20)

#### Response
```json
{
  "success": true,
  "sessions": [
    {
      "id": 456,
      "startedAt": "2024-11-28T10:30:00Z",
      "endedAt": "2024-11-28T10:45:00Z",
      "status": "active",
      "totalMessages": 8,
      "lastMessage": "شكراً، كان مفيد",
      "deviceType": "mobile"
    }
  ],
  "count": 1
}
```

---

### 3. Get Session History
**GET** `/history/:sessionId?user_id=123`

Get complete conversation history for a session.

#### Parameters
- `sessionId` (path): Session ID
- `user_id` (query): User ID (for authorization)

#### Response
```json
{
  "success": true,
  "session": {
    "id": 456,
    "startedAt": "2024-11-28T10:30:00Z",
    "endedAt": "2024-11-28T10:45:00Z",
    "status": "closed",
    "totalMessages": 8,
    "messages": [
      {
        "id": 1,
        "senderType": "user",
        "text": "شحال تمن الطماطم؟",
        "audioUrl": null,
        "createdAt": "2024-11-28T10:30:15Z",
        "intent": "price_inquiry",
        "sources": []
      },
      {
        "id": 2,
        "senderType": "bot",
        "text": "الطماطم اليوم 60 دينار...",
        "audioUrl": null,
        "createdAt": "2024-11-28T10:30:18Z",
        "intent": null,
        "sources": [...]
      }
    ]
  }
}
```

---

### 4. Close Session
**PUT** `/session/:sessionId/close`

Mark a session as closed.

#### Request Body
```json
{
  "user_id": 123,
  "summary": "User asked about tomato prices and planting advice"  // Optional
}
```

#### Response
```json
{
  "success": true,
  "message": "Session closed successfully"
}
```

---

### 5. Delete Session
**DELETE** `/session/:sessionId?user_id=123`

Delete a session (GDPR compliance).

#### Parameters
- `sessionId` (path): Session ID
- `user_id` (query): User ID (for authorization)

#### Response
```json
{
  "success": true,
  "message": "Session deleted successfully"
}
```

---

### 6. Health Check
**GET** `/health`

Check if the chatbot service is operational.

#### Response
```json
{
  "success": true,
  "service": "AgriBot Chatbot API",
  "status": "operational",
  "timestamp": "2024-11-28T10:30:00Z"
}
```

---

## Intent Types

The chatbot can classify the following user intents:

| Intent | Description | Example (Darja) |
|--------|-------------|-----------------|
| `price_inquiry` | Market price questions | "شحال تمن البطاطا؟" |
| `weather_query` | Weather forecasts | "كيفاش الجو هاد الأسبوع؟" |
| `crop_advice` | Planting recommendations | "واش ندير في الربيع؟" |
| `disease_help` | Pest/disease management | "عندي مرض في الطماطم" |
| `yield_prediction` | Yield/production questions | "قداش يطلع البطاطا؟" |
| `fertilizer_advice` | Fertilizer recommendations | "واش نحط من السماد؟" |
| `irrigation` | Watering guidance | "قداش نسقيه؟" |
| `general_inquiry` | General questions | Fallback intent |

---

## Supported Languages

AgriBot supports multilingual queries:
- **Darja** (Algerian Arabic dialect) - Primary
- **Modern Standard Arabic**
- **French**
- **English**

The bot automatically detects the language and responds in the same language.

---

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "error": "user_id and message are required"
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": "Session not found or unauthorized"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Internal server error",
  "message": "Detailed error message"
}
```

---

## Example Usage (JavaScript)

```javascript
// Send a message
const response = await fetch('http://localhost:3000/api/chatbot/message', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    user_id: 123,
    session_id: null,  // Create new session
    message: "كيفاش ندير البطاطا في الربيع؟",
    device_type: 'web'
  })
});

const data = await response.json();
console.log('Bot says:', data.response.text);
console.log('Intent:', data.response.intent);
console.log('Sources:', data.sources);
```

---

## Rate Limiting

- **50 requests per 15 minutes** per user
- Exceeding limits returns HTTP 429

---

## Data Privacy

- Chat history retained for **30 days** by default
- Users can delete sessions via the DELETE endpoint
- Personal data is anonymized for analytics
- GDPR compliant

---

## Performance Metrics

- **Average Response Time**: < 3 seconds
- **AI Processing Time**: 1-2 seconds
- **Search API Time**: 500-800ms (when used)

---

## Dependencies

- Hugging Face Inference API (Mistral-7B)
- Tavily Search API
- PostgreSQL Database

---

## Support

For issues or questions, contact the development team.
