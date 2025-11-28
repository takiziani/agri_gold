# AgriBot Chatbot - Quick Test Examples

## Using curl

### 1. Health Check (No auth required)
```bash
curl http://localhost:3000/api/chatbot/health
```

Expected:
```json
{
  "success": true,
  "service": "AgriBot Chatbot API",
  "status": "operational"
}
```

---

### 2. Simple English Query
```bash
curl -X POST http://localhost:3000/api/chatbot/message \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 1,
    "message": "What crops should I plant in spring?"
  }'
```

---

### 3. Price Inquiry (Darja)
```bash
curl -X POST http://localhost:3000/api/chatbot/message \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 1,
    "message": "شحال تمن الطماطم اليوم؟"
  }'
```

---

### 4. Weather Query (French)
```bash
curl -X POST http://localhost:3000/api/chatbot/message \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 1,
    "message": "Quel temps fait-il cette semaine?"
  }'
```

---

### 5. Multi-Turn Conversation
```bash
# First message (creates new session)
curl -X POST http://localhost:3000/api/chatbot/message \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 1,
    "message": "I want to grow potatoes"
  }'

# Note the session_id from response, then:
curl -X POST http://localhost:3000/api/chatbot/message \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 1,
    "session_id": 456,
    "message": "What fertilizer should I use?"
  }'
```

---

### 6. Get User Sessions
```bash
curl http://localhost:3000/api/chatbot/sessions/1
```

---

### 7. Get Session History
```bash
curl "http://localhost:3000/api/chatbot/history/456?user_id=1"
```

---

### 8. Delete Session (GDPR)
```bash
curl -X DELETE "http://localhost:3000/api/chatbot/session/456?user_id=1"
```

---

## Using JavaScript (Fetch API)

```javascript
// Send a message
async function sendMessage(userId, message, sessionId = null) {
  const response = await fetch('http://localhost:3000/api/chatbot/message', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      user_id: userId,
      session_id: sessionId,
      message: message,
      device_type: 'web'
    })
  });
  
  const data = await response.json();
  
  if (data.success) {
    console.log('Bot says:', data.response.text);
    console.log('Intent:', data.response.intent);
    console.log('Session ID:', data.sessionId);
    
    if (data.sources.length > 0) {
      console.log('Sources:');
      data.sources.forEach(source => {
        console.log(`- ${source.title}: ${source.url}`);
      });
    }
  }
  
  return data;
}

// Example usage
const result = await sendMessage(1, "شحال تمن البطاطا؟");
```

---

## Using Python (requests)

```python
import requests

def send_message(user_id, message, session_id=None):
    url = "http://localhost:3000/api/chatbot/message"
    
    payload = {
        "user_id": user_id,
        "message": message,
        "session_id": session_id,
        "device_type": "mobile"
    }
    
    response = requests.post(url, json=payload)
    data = response.json()
    
    if data.get("success"):
        print(f"Bot: {data['response']['text']}")
        print(f"Intent: {data['response']['intent']}")
        print(f"Session: {data['sessionId']}")
    
    return data

# Example
result = send_message(1, "What should I plant in Setif?")
```

---

## Expected Response Format

```json
{
  "success": true,
  "sessionId": 123,
  "response": {
    "text": "Based on your soil in Setif (Nitrogen: 42 ppm, Phosphorus: 28 ppm)...",
    "intent": "crop_advice",
    "confidence": 1.0
  },
  "sources": [
    {
      "title": "Growing Crops in Algeria",
      "url": "https://agriculture.dz/crops",
      "content": "Detailed agricultural information..."
    }
  ],
  "searchPerformed": false,
  "userContextUsed": true,
  "metadata": {
    "totalTime": 2145,
    "aiTime": 1823,
    "tokensUsed": 412
  }
}
```

---

## Testing Different Intents

| Intent | Test Message (English) | Test Message (Darja) |
|--------|------------------------|----------------------|
| price_inquiry | "How much are tomatoes today?" | "شحال تمن الطماطم اليوم؟" |
| weather_query | "Will it rain this week?" | "راح يصب الشتا هاد الأسبوع؟" |
| crop_advice | "What should I plant in spring?" | "واش ندير في الربيع؟" |
| disease_help | "My tomatoes have brown spots" | "الطماطم عندهم بقع كحلة" |
| yield_prediction | "How much wheat can I harvest?" | "قداش يطلع القمح؟" |
| fertilizer_advice | "What fertilizer for potatoes?" | "واش نحط من السماد للبطاطا؟" |
| irrigation | "How often should I water?" | "قداش مرة نسقي؟" |

---

## Troubleshooting

### Error: "HUGGING_FACE_API_KEY not set"
1. Create `.env` file from `.env.example`
2. Add your Hugging Face API key
3. Restart server

### Bot responds in wrong language
- The bot mirrors the language of your input
- Check for mixed languages in query
- Example: "شحال price" → may confuse detector

### "Using mock search results" warning
- Normal if Tavily API key not configured
- Bot still works, but search data is fake
- Add TAVILY_API_KEY to .env for real searches

---

## Next Steps After Testing

1. **Verify personalization**:
   - Create users with prediction history
   - Confirm bot references past crops/yields

2. **Test all intents**:
   - Use the table above
   - Verify correct intent classification

3. **Check performance**:
   - Response should be <3 seconds
   - Check `metadata.totalTime` in response

4. **Test conversation memory**:
   - Send multiple messages in same session
   - Verify bot remembers context

---

## Production Checklist

Before going to production:

- [ ] Add authentication middleware
- [ ] Set up rate limiting (50 req/15min per user)
- [ ] Configure monitoring (error tracking)
- [ ] Load test with 100+ concurrent users
- [ ] Set up automated cache cleanup cron job
- [ ] Configure CORS for your frontend domain
- [ ] Review and optimize database indexes
- [ ] Set up backup strategy for chat_messages table

---

**Happy Testing!** 🚀
