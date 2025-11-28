# AgriBot Chatbot Setup Guide

## ✅ Implementation Complete

The AgriBot chatbot system has been fully implemented with the following components:

### Database Schemas
- ✅ `chat_sessions` - Conversation session tracking
- ✅ `chat_messages` - Individual message storage with metadata
- ✅ `user_context_cache` - User prediction history cache
- ✅ `search_cache` - Web search results caching

### Services
- ✅ `intentClassifier.js` - Intent detection (8 intents supported)
- ✅ `contextBuilder.js` - User history aggregation
- ✅ `aiService.js` - Hugging Face API integration
- ✅ `searchService.js` - Tavily/Web search with caching
- ✅ `chatbotService.js` - Main orchestration service

### API Routes
- ✅ `POST /api/chatbot/message` - Send messages
- ✅ `GET /api/chatbot/sessions/:userId` - Get user sessions
- ✅ `GET /api/chatbot/history/:sessionId` - Get conversation history
- ✅ `PUT /api/chatbot/session/:sessionId/close` - Close session
- ✅ `DELETE /api/chatbot/session/:sessionId` - Delete session
- ✅ `GET /api/chatbot/health` - Health check

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install @huggingface/inference
```

### 2. Environment Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

**Required Configuration:**
```env
# Hugging Face API Key (REQUIRED)
HUGGING_FACE_API_KEY=hf_your_key_here

# Optional: Tavily Search API (uses mock data if not set)
TAVILY_API_KEY=tvly-your_key_here
```

### 3. Get API Keys

#### Hugging Face (Required)
1. Go to https://huggingface.co/settings/tokens
2. Create a new token with "Read" permissions
3. Copy token to `.env`

**Free Tier**: 1000 requests/day

#### Tavily Search (Optional)
1. Go to https://tavily.com
2. Sign up for free account
3. Copy API key to `.env`

**Free Tier**: 1000 searches/month

**Note**: If Tavily key is not set, the chatbot will use mock search results (suitable for development).

### 4. Database Migration

The database tables will auto-create when you start the server:

```bash
npm run start:dev
```

### 5. Test the API

```bash
curl -X POST http://localhost:3000/api/chatbot/message \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 1,
    "message": "What should I plant in spring?"
  }'
```

---

## 📚 Features Implemented

### 🎯 Intent Classification
Automatically detects:
- Price inquiries ("شحال تمن الطماطم؟")
- Weather queries ("كيفاش الجو؟")
- Crop advice ("واش ندير في الربيع؟")
- Disease help
- Yield predictions
- Fertilizer advice
- Irrigation guidance

### 🧠 Personalized Context
- Auto-fetches user's last 10 predictions
- Calculates average soil metrics (N, P, K, pH)
- Identifies user's region and preferred season
- Caches context for 24 hours (performance optimization)

### 🔍 Smart Web Search
- Only searches when needed (real-time data required)
- Caches results to reduce API costs
- TTL varies by query type:
  - Weather: 6 hours
  - Prices: 12 hours
  - General: 7 days

### 💬 Multi-Turn Conversations
- Maintains conversation history
- Auto-summarizes old messages to fit LLM context window
- Session management (active/closed/abandoned)

### 🌍 Multilingual Support
- Darja (Algerian Arabic) - Primary
- Modern Standard Arabic
- French
- English
- Auto-detects language from user input

---

## 🧪 Testing

### Manual Testing

1. **Send a simple message:**
```javascript
const response = await fetch('http://localhost:3000/api/chatbot/message', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    user_id: 1,
    message: "Hello, what crops can I plant?"
  })
});

const data = await response.json();
console.log(data.response.text);
```

2. **Check user sessions:**
```bash
curl http://localhost:3000/api/chatbot/sessions/1
```

3. **Health check:**
```bash
curl http://localhost:3000/api/chatbot/health
```

### Test with Darja

```javascript
{
  "user_id": 1,
  "message": "شحال تمن الطماطم اليوم؟"
}
```

Expected: Bot responds in Arabic with price information.

---

## 📖 API Documentation

See `docs/CHATBOT_API.md` for complete API reference.

---

## 🔧 Configuration Options

### Chat History Retention

Default: 30 days

To change, modify in `chatbotService.js`:
```javascript
// Add cleanup job
setInterval(async () => {
  await cleanOldSessions(30); // days
}, 24 * 60 * 60 * 1000); // Run daily
```

### Context Cache TTL

Default: 24 hours

To change, modify in `contextBuilder.js`:
```javascript
const CACHE_TTL_HOURS = 24; // Change to your preference
```

### LLM Model

Default: `mistralai/Mistral-7B-Instruct-v0.3`

To change, modify in `aiService.js`:
```javascript
model: "meta-llama/Llama-3.1-8B-Instruct" // Alternative
```

---

## 💰 Cost Estimation

### Development (Free Tier)
- Hugging Face: 1000 req/day FREE
- Tavily: 1000 searches/month FREE
- Total: **$0/month**

### Production (1000 active users)
- Hugging Face Pro: ~$75/month (30k requests)
- Tavily: ~$25/month (5k searches)
- Database: ~$30/month (AWS RDS)
- Total: **~$130/month**

---

## 🚨 Troubleshooting

### "Error: HUGGING_FACE_API_KEY not set"
- Check `.env` file exists
- Verify key format: `hf_xxxxxxxxxxxxx`
- Restart server after adding key

### "Using mock search results"
- Normal if `TAVILY_API_KEY` not set
- Chatbot still works, but uses fake search data
- Add Tavily key for real web search

### Database connection errors
- Check PostgreSQL is running
- Verify `.env` database credentials
- Run `npm run start:dev` to see detailed errors

### Slow response times
- Normal on first request (cold start)
- Subsequent requests should be <3 seconds
- Check Hugging Face API status: https://status.huggingface.co

---

## 🔐 Security Notes

- Never commit `.env` file to Git
- API keys are sensitive - keep them private
- Use environment variables for production
- Implement authentication middleware for production
- Current implementation assumes trusted network

---

## 📈 Next Steps

### Phase 3: Voice Interface (Future)
- [ ] Integrate Google Cloud STT/TTS
- [ ] Add audio file upload handling
- [ ] Optimize responses for voice (shorter)

### Phase 4: Darja Fine-Tuning (Future)
- [ ] Collect Darja conversation samples
- [ ] Fine-tune prompt engineering
- [ ] Custom STT model training

### Phase 5: Advanced Features (Future)
- [ ] Integration with Souk-Pulse predictions
- [ ] Proactive notifications
- [ ] Image analysis for disease detection
- [ ] Group chat for Virtual Cooperative

---

## 📞 Support

For issues or questions:
1. Check `docs/CHATBOT_API.md` for API reference
2. Review implementation plan: `chatbot_implementation_plan.md`
3. Contact development team

---

## ✨ Credits

- **AI Model**: Mistral-7B-Instruct (Hugging Face)
- **Search**: Tavily AI
- **Framework**: Express.js + Sequelize
- **Database**: PostgreSQL

**Version**: 1.0.0  
**Last Updated**: 2024-11-28
