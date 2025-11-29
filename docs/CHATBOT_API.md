# AgriBot Chatbot API Documentation

Updated contract: three routes only, wired directly to the two-table schema (`chat`, `message`). Every request must include the `user_id` in the body (JSON). For clients that cannot send a JSON body with `GET`, add `user_id` as a query string parameter; the backend will check both locations.

## Base URL

```
http://localhost:3000/api/chatbot
```

---

## Quick Start

```bash
# Send a new message and receive the bot response
curl -X POST http://localhost:3000/api/chatbot/messages \
  -H "Content-Type: application/json" \
  -d '{
        "user_id": 42,
        "message": "شحال تمن الطماطم اليوم؟"
      }'

# Read the latest 20 messages (inverse order)
curl -X GET "http://localhost:3000/api/chatbot/messages?limit=20" \
  -H "Content-Type: application/json" \
  -d '{"user_id": 42}'

# Delete a specific message
curl -X DELETE http://localhost:3000/api/chatbot/messages/1287 \
  -H "Content-Type: application/json" \
  -d '{"user_id": 42}'
```

---

## Endpoints

### 1. Send Message (Write Route)

**POST** `/messages`

Request body:

```json
{
  "user_id": 42,
  "message": "كيفاش نتعامل مع مرض البطاطا؟"
}
```

Response:

```json
{
  "success": true,
  "chatId": 15,
  "userMessage": {
    "id": 901,
    "text": "كيفاش نتعامل مع مرض البطاطا؟",
    "timestamp": "2024-11-30T10:15:22.821Z"
  },
  "botMessage": {
    "id": 902,
    "text": "راقب الأوراق ...",
    "timestamp": "2024-11-30T10:15:24.078Z"
  },
  "intent": "disease_help",
  "confidence": 0.94,
  "sources": [],
  "searchPerformed": false,
  "userContextUsed": true,
  "metadata": {
    "totalTime": 1875,
    "aiTime": 1421,
    "tokensUsed": 512
  }
}
```

### 2. Read Messages (Read Route)

**GET** `/messages`

Parameters (query string or JSON body):

- `user_id` **(required)** – identifies the single chat assigned to the user
- `limit` _(optional)_ – 1..100, default `50`
- `before` _(optional)_ – message ID cursor; returns messages with IDs `< before`

> Messages are returned in chronological order (oldest → newest). Use the `before` cursor to walk further back in time; the response’s `nextCursor` is the ID you should pass as the next `before` to keep paginating.

Response:

```json
{
  "success": true,
  "chatId": 15,
  "messages": [
    {
      "id": 901,
      "text": "كيفاش نتعامل مع مرض البطاطا؟",
      "isUser": true,
      "timestamp": "2024-11-30T10:15:22.821Z"
    },
    {
      "id": 902,
      "text": "راقب الأوراق ...",
      "isUser": false,
      "timestamp": "2024-11-30T10:15:24.078Z"
    }
  ],
  "pagination": {
    "hasMore": true,
    "hasPrevious": true,
    "nextCursor": 875,
    "previousCursor": 902,
    "total": 184,
    "pageSize": 2
  }
}
```

### 3. Delete Message (Delete Route)

**DELETE** `/messages/:messageId`

Body:

```json
{
  "user_id": 42
}
```

Response (success):

```json
{
  "success": true
}
```

Possible errors:

- `404` – message not found for that user
- `400` – invalid identifiers

---

## Pagination Rules

- Cursor-based, using message IDs.
- Always ordered `DESC` by `created_at` (latest message first).
- `limit` is clamped between `1` and `100`.
- `hasPrevious` flips to `true` as soon as a `before` cursor is supplied.

---

## Language + Intent Support

- **Language mirroring**: Darja (primary), Modern Standard Arabic, French, English.
- **Adaptive prompt** ensures the bot answers using the detected language.
- Intents detected: `price_inquiry`, `weather_query`, `crop_advice`, `disease_help`, `yield_prediction`, `fertilizer_advice`, `irrigation`, `general_inquiry`.

---

## Error Shapes

```json
{
  "success": false,
  "error": "user_id and message are required"
}
```

```json
{
  "success": false,
  "error": "Message not found"
}
```

```json
{
  "success": false,
  "error": "Internal server error",
  "message": "Detailed error message"
}
```

---

## Prediction History API

These endpoints store the raw payload sent to the ML crop/yield model and the structured analysis returned. They live under `http://localhost:3000/api/history` and operate on the two history tables directly.

### 4. Log Prediction Input

**POST** `/predict-inputs`

Body (all numeric fields can be strings; the server casts them to floats):

```json
{
  "user_id": 42,
  "Temperature": "18.5",
  "Humidity": "55",
  "Nitrogen": "1.29",
  "Phosphorus": "7.73",
  "Potassium": "60.25",
  "Ph": "7",
  "Rainfall": "10",
  "state": "Jharkhand",
  "season": "Summer"
}
```

Response:

```json
{
  "success": true,
  "record": {
    "id": 311,
    "user_id": 42,
    "nitrogen": 1.29,
    "phosphorus": 7.73,
    "potassium": 60.25,
    "temperature": 18.5,
    "humidity": 55,
    "ph": 7,
    "rainfall": 10,
    "state": "Jharkhand",
    "season": "Summer",
    "created_at": "2025-11-28T10:12:43.000Z"
  }
}
```

### 5. Delete Prediction Input

**DELETE** `/predict-inputs/:inputId`

Body:

```json
{ "user_id": 42 }
```

Deletes the row plus any linked outputs. Returns `{ "success": true }` or `404` if the ID does not belong to that user.

### 6. Log Prediction Output

**POST** `/predict-outputs`

Body (excerpted for brevity):

```json
{
  "user_id": 42,
  "input_id": 311,
  "analysisData": {
    "yield_prediction": {
      "crop": "Mango",
      "predicted_yield": 2.61,
      "unit": "metric ton per hectare",
      "state": "Jharkhand"
    },
    "crop_recommendation": {
      "recommended_crop": "Mango",
      "recommendation_basis": "Highest positive yield",
      "ranking": "Best yield among 2 tested crops",
      "selection_criteria": "Maximum predicted yield",
      "suitable_for": "Jharkhand region during Summer season"
    },
    "alternative_crops": [
      { "crop": "Mango", "predicted_yield": 2.61, "price_per_ton": 35000 }
    ],
    "agricultural_parameters": {
      "annual_rainfall": 1257.2,
      "fertilizer": 1149375,
      "pesticide": 2618
    }
  }
}
```

The service persists the first-class fields (`best_crop`, `predicted_yield`, `unit`, `region`, ranking metadata, price information, etc.) and stores the raw `alternative_crops` array as JSON.

### 7. Delete Prediction Output

**DELETE** `/predict-outputs/:outputId`

Body: `{ "user_id": 42 }`. Removes only the specified output row.

---

## Operational Notes

- No authentication layer; `user_id` travels inside the request body (or query/header for the GET messages route).
- Single chat row per user; deleting a chat message keeps the chat and recalculates counters.
- Prediction history endpoints perform hard deletes and enforce that the requesting user owns the record ID.
- Responses include metadata about AI latency, token usage, and context utilization where applicable.

---

## Support

Contact the AgriBot platform team for onboarding keys or troubleshooting.

---

## Export Endpoints

Located under `/api/export` for quick data dumps of unified `prediction` records.

### GET `/api/export/json`

Returns every `prediction` row ordered by `user_id` and `created_at` ascending.

```
curl http://localhost:3000/api/export/json
```

```json
{
  "success": true,
  "count": 128,
  "rows": [
    {
      "id": 42,
      "user_id": 3,
      "field_id": 9,
      "field_name": "Setif North Plot",
      "best_crop": "wheat",
      "predicted_yield": 5.2,
      "unit": "metric ton per hectare",
      "nitrogen": 42,
      "phosphorus": 28,
      "potassium": 35,
      "temperature": 18,
      "humidity": 65,
      "ph": 6.8,
      "rainfall": 450,
      "state": "Setif",
      "season": "Winter",
      "aiExplain": "High nitrogen and balanced rainfall favor winter wheat.",
      "created_at": "2025-11-21T09:01:43.000Z"
    }
  ]
}
```

### GET `/api/export/csv`

Streams the same dataset as CSV with a header row.

```
curl -o predictions.csv \
  http://localhost:3000/api/export/csv
```

### GET `/api/export/docx`

Generates a DOCX intelligence report for the full dataset. The backend aggregates the metrics,
asks the HuggingFace model for structured insights, and streams the resulting `.docx` file.

```
curl -o predictions_report.docx \
  http://localhost:3000/api/export/docx
```

### GET `/api/export/pdf`

Same intelligence report rendered as PDF.

```
curl -o predictions_report.pdf \
  http://localhost:3000/api/export/pdf
```

---

## Notification Endpoints

Neighbor alerts fire automatically after a prediction is generated. These routes let you
inspect or manually retrigger notifications.

### GET `/api/notifications`

Requires bearer token. Returns the latest notifications for the authenticated user.

```
Authorization: Bearer <access token>
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/notifications
```

### PATCH `/api/notifications/:id/read`

Marks a specific notification as read.

```
curl -X PATCH -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/notifications/123/read
```

### POST `/api/notifications/neighbor-alerts`

Triggers the neighbor search manually (helpful for replays or admin tooling).

Body:

```json
{
  "prediction_id": 77,
  "field_id": 12,
  "radius_km": 5
}
```

The endpoint responds with `{ "created": <count>, "neighbors": [userIds...] }` when
new notifications are inserted.
