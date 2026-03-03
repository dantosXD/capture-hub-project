# 📡 Capture Hub API Documentation

Complete API reference for Capture Hub, including REST endpoints and WebSocket events.

**Base URL:** `http://localhost:3000` (development) or your production domain

**API Version:** 1.0

**Content-Type:** `application/json`

---

## Table of Contents

- [Authentication](#authentication)
- [Response Format](#response-format)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [REST API Endpoints](#rest-api-endpoints)
  - [Health Check](#health-check)
  - [Capture Items](#capture-items)
  - [Projects](#projects)
  - [Search](#search)
  - [Export](#export)
  - [Stats](#stats)
  - [Templates](#templates)
  - [Tags](#tags)
  - [Links](#links)
  - [Devices](#devices)
  - [AI Endpoints](#ai-endpoints)
- [WebSocket API](#websocket-api)

---

## Authentication

Capture Hub is a **single-tenant application** with no authentication required. All endpoints are publicly accessible within your trusted environment.

> **⚠️ Security Note:** In production, deploy behind a reverse proxy (nginx, Caddy) with IP whitelisting or VPN access to secure your instance.

---

## Response Format

### Success Response

```json
{
  "data": { ... },
  "pagination": {
    "currentPage": 1,
    "limit": 20,
    "totalCount": 100,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

### Error Response

```json
{
  "error": "Error message description",
  "details": "Additional error details (optional)"
}
```

---

## Error Handling

The API uses standard HTTP status codes:

| Code | Description |
|------|-------------|
| `200` | Success |
| `201` | Created |
| `400` | Bad Request - Invalid parameters |
| `404` | Not Found |
| `500` | Internal Server Error |

### Common Error Examples

```json
// 400 - Invalid parameter
{
  "error": "Invalid type parameter. Must be one of: note, scratchpad, ocr, screenshot, webpage"
}

// 400 - Missing required field
{
  "error": "Title is required and must be a non-empty string"
}

// 500 - Internal error
{
  "error": "Failed to fetch items",
  "details": "Database connection error"
}
```

---

## Rate Limiting

**No rate limiting** is currently implemented. Capture Hub is designed for single-user use across multiple devices.

---

## REST API Endpoints

### Health Check

Check API and database status.

```http
GET /api/health
```

**Response:**

```json
{
  "status": "healthy",
  "database": {
    "status": "connected",
    "tables": ["CaptureItem", "Project", "Template", "ItemLink", "ConnectedDevice", "User", "Post"]
  },
  "websocket": {
    "status": "running",
    "connectedDevices": 2,
    "path": "/ws"
  }
}
```

---

### Capture Items

Manage notes, screenshots, OCR results, web captures, and scratchpad entries.

#### List Items

```http
GET /api/capture?type=note&status=inbox&page=1&limit=20
```

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `type` | string | No | - | Filter by type: `note`, `scratchpad`, `ocr`, `screenshot`, `webpage` |
| `status` | string | No | - | Filter by status: `inbox`, `assigned`, `archived`, `trash` |
| `page` | integer | No | `1` | Page number (1-indexed) |
| `limit` | integer | No | `20` | Items per page (1-100) |
| `offset` | integer | No | `0` | Alternative to page, skip N items |

**Response:**

```json
{
  "items": [
    {
      "id": "clx1234567890",
      "type": "note",
      "title": "Meeting notes",
      "content": "Discussed project timeline...",
      "extractedText": null,
      "imageUrl": null,
      "sourceUrl": null,
      "metadata": null,
      "tags": ["work", "meeting"],
      "priority": "medium",
      "status": "inbox",
      "assignedTo": null,
      "dueDate": null,
      "reminder": null,
      "reminderSent": false,
      "pinned": false,
      "projectId": null,
      "processedAt": null,
      "processedBy": null,
      "createdAt": "2025-02-18T10:30:00.000Z",
      "updatedAt": "2025-02-18T10:30:00.000Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "limit": 20,
    "totalCount": 45,
    "totalPages": 3,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

#### Create Item

```http
POST /api/capture
```

**Request Body:**

```json
{
  "type": "note",
  "title": "Project ideas",
  "content": "1. Add dark mode\n2. Implement search",
  "tags": ["ideas"],
  "priority": "high",
  "status": "inbox",
  "projectId": null
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `type` | string | No | `note` | Item type: `note`, `scratchpad`, `ocr`, `screenshot`, `webpage` |
| `title` | string | **Yes** | - | Item title |
| `content` | string | No | `null` | Main content (markdown supported) |
| `extractedText` | string | No | `null` | OCR extracted text |
| `imageUrl` | string | No | `null` | URL to uploaded image |
| `sourceUrl` | string | No | `null` | Source URL for web captures |
| `metadata` | object | No | `null` | Additional metadata (JSON) |
| `tags` | array | No | `[]` | Array of tag strings |
| `priority` | string | No | `none` | Priority: `none`, `low`, `medium`, `high` |
| `status` | string | No | `inbox` | Status: `inbox`, `assigned`, `archived`, `trash` |
| `assignedTo` | string | No | `null` | Assignment target (e.g., project name) |
| `dueDate` | string | No | `null` | ISO 8601 date string |
| `projectId` | string | No | `null` | Associated project ID |

**Response:** `201 Created`

```json
{
  "id": "clx9876543210",
  "type": "note",
  "title": "Project ideas",
  "content": "1. Add dark mode\n2. Implement search",
  "tags": ["ideas"],
  "priority": "high",
  "status": "inbox",
  "createdAt": "2025-02-18T12:00:00.000Z",
  "updatedAt": "2025-02-18T12:00:00.000Z"
}
```

> **Note:** AI auto-tagging runs asynchronously. Tags may be updated after creation.

#### Get Single Item

```http
GET /api/capture/{id}
```

**Response:** Single item object (same format as create response)

#### Update Item

```http
PUT /api/capture/{id}
```

**Request Body:** Same as create item (all fields optional)

**Response:** Updated item object

#### Delete Item

```http
DELETE /api/capture/{id}
```

**Response:** `204 No Content`

#### Bulk Operations

```http
POST /api/capture/bulk
```

**Request Body:**

```json
{
  "action": "update",
  "itemIds": ["id1", "id2", "id3"],
  "updates": {
    "status": "archived",
    "tags": ["processed"]
  }
}
```

| Action | Description |
|--------|-------------|
| `update` | Apply updates to multiple items |
| `delete` | Delete multiple items (move to trash) |

**Response:**

```json
{
  "success": true,
  "affected": 3
}
```

---

### Projects

Organize items into projects.

#### List Projects

```http
GET /api/projects
```

**Response:**

```json
{
  "projects": [
    {
      "id": "clx1111111111",
      "name": "Website Redesign",
      "description": "Main website overhaul project",
      "color": "#6366f1",
      "icon": "🌐",
      "status": "active",
      "priority": "high",
      "dueDate": "2025-03-01T00:00:00.000Z",
      "order": 0,
      "itemCount": 12,
      "createdAt": "2025-02-01T10:00:00.000Z",
      "updatedAt": "2025-02-18T12:00:00.000Z"
    }
  ]
}
```

#### Create Project

```http
POST /api/projects
```

**Request Body:**

```json
{
  "name": "New Project",
  "description": "Project description",
  "color": "#10b981",
  "icon": "📁",
  "status": "active",
  "priority": "medium",
  "dueDate": "2025-04-01T00:00:00.000Z"
}
```

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `name` | string | **Yes** | - |
| `description` | string | No | `null` |
| `color` | string | No | `#6366f1` |
| `icon` | string | No | `null` |
| `status` | string | No | `active` |
| `priority` | string | No | `medium` |
| `dueDate` | string | No | `null` |

**Response:** `201 Created`

```json
{
  "project": {
    "id": "clx2222222222",
    "name": "New Project",
    "description": "Project description",
    "color": "#10b981",
    "icon": "📁",
    "status": "active",
    "priority": "medium",
    "dueDate": "2025-04-01T00:00:00.000Z",
    "order": 1,
    "createdAt": "2025-02-18T12:00:00.000Z",
    "updatedAt": "2025-02-18T12:00:00.000Z"
  }
}
```

#### Get Project Details

```http
GET /api/projects/{id}
```

**Response:** Single project with items array

#### Update Project

```http
PUT /api/projects/{id}
```

**Request Body:** Same as create project (all fields optional)

#### Delete Project

```http
DELETE /api/projects/{id}
```

**Response:** `204 No Content`

---

### Search

Full-text search across all items.

```http
GET /api/search?q=project&type=note&aiEnhanced=true&limit=20
```

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `q` | string | **Yes** | - | Search query |
| `type` | string | No | - | Filter by item type |
| `status` | string | No | - | Filter by status |
| `aiEnhanced` | boolean | No | `false` | Use AI for result ranking |
| `ai` | boolean | No | `false` | Alias for aiEnhanced |
| `limit` | integer | No | `20` | Max results |

**Response:**

```json
{
  "items": [
    {
      "id": "clx1234567890",
      "title": "Project timeline",
      "content": "Discussed the project schedule...",
      "type": "note",
      "tags": ["project"],
      "rank": 0.95
    }
  ],
  "total": 5,
  "query": "project"
}
```

> **Note:** Special characters (`%`, `_`, `\`) are properly escaped in search queries.

---

### Export

Export data in various formats.

```http
GET /api/export?format=json&status=inbox&type=note&tag=work
```

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `format` | string | No | `json` | Export format: `json`, `markdown`, `csv`, `md` |
| `status` | string | No | - | Filter by status |
| `type` | string | No | - | Filter by type |
| `priority` | string | No | - | Filter by priority |
| `assignedTo` | string | No | - | Filter by assignment |
| `tag` | string | No | - | Filter by tag |
| `pinned` | boolean | No | - | Filter by pinned status |
| `projectId` | string | No | - | Filter by project |
| `search` | string | No | - | Search in title/content |

**Response Format:**

- **JSON** (`application/json`): Full data export with metadata
- **Markdown** (`text/markdown`): Formatted document download
- **CSV** (`text/csv`): Spreadsheet-compatible file

All responses trigger a browser download with filename: `capture-hub-export-YYYY-MM-DD.{ext}`

---

### Stats

Get dashboard statistics.

```http
GET /api/stats
```

**Response:**

```json
{
  "inbox": 12,
  "assigned": 8,
  "projects": 8,
  "archived": 45,
  "trash": 3,
  "total": 68,
  "today": 5,
  "thisWeek": 23,
  "lastWeek": 18,
  "weekOverWeek": 27.8,
  "weekOverWeekTrend": "up",
  "inboxThisWeek": 15,
  "inboxLastWeek": 12,
  "inboxWeekOverWeek": 25.0,
  "inboxWeekOverWeekTrend": "up",
  "processedThisWeek": 8,
  "processedLastWeek": 6,
  "processingRateThisWeek": "34.8",
  "processingRateLastWeek": "33.3",
  "processingRateChange": 4.5,
  "processingRateTrend": "stable",
  "processed": 30,
  "processingRate": "44.1",
  "stale": 5,
  "recentItems": [
    {
      "id": "clx1234567890",
      "title": "Recent item",
      "type": "note",
      "createdAt": "2025-02-18T10:00:00.000Z"
    }
  ]
}
```

---

### Templates

Manage reusable content templates.

#### List Templates

```http
GET /api/templates
```

**Response:**

```json
{
  "templates": [
    {
      "id": "clx3333333333",
      "name": "Meeting Notes",
      "description": "Standard meeting template",
      "content": "## Attendees\n\n## Agenda\n\n## Notes\n\n## Action Items",
      "category": "general",
      "icon": "📝",
      "variables": ["attendees", "agenda"],
      "isDefault": false,
      "projectId": null,
      "createdAt": "2025-02-01T10:00:00.000Z",
      "updatedAt": "2025-02-18T12:00:00.000Z"
    }
  ]
}
```

#### Create Template

```http
POST /api/templates
```

**Request Body:**

```json
{
  "name": "Daily Standup",
  "description": "Daily standup notes",
  "content": "## Yesterday\n\n## Today\n\n## Blockers",
  "category": "daily",
  "icon": "📅",
  "variables": null,
  "isDefault": false,
  "projectId": null
}
```

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `name` | string | **Yes** | - |
| `description` | string | No | `null` |
| `content` | string | **Yes** | - |
| `category` | string | No | `general` |
| `icon` | string | No | `null` |
| `variables` | array | No | `null` |
| `isDefault` | boolean | No | `false` |
| `projectId` | string | No | `null` |

#### Get Template

```http
GET /api/templates/{id}
```

#### Update Template

```http
PUT /api/templates/{id}
```

#### Delete Template

```http
DELETE /api/templates/{id}
```

#### Seed Default Templates

```http
POST /api/templates/seed
```

Creates default templates if none exist.

---

### Tags

Get all unique tags across items.

```http
GET /api/tags
```

**Response:**

```json
{
  "tags": [
    { "name": "work", "count": 15 },
    { "name": "personal", "count": 8 },
    { "name": "ideas", "count": 5 }
  ]
}
```

---

### Links

Manage knowledge graph links between items.

#### List Links

```http
GET /api/links
```

**Response:**

```json
{
  "links": [
    {
      "id": "clx4444444444",
      "sourceId": "clx1234567890",
      "targetId": "clx9876543210",
      "relationType": "related",
      "note": "These items are connected",
      "createdAt": "2025-02-18T12:00:00.000Z"
    }
  ]
}
```

#### Create Link

```http
POST /api/links
```

**Request Body:**

```json
{
  "sourceId": "clx1234567890",
  "targetId": "clx9876543210",
  "relationType": "related",
  "note": "Optional connection note"
}
```

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `sourceId` | string | **Yes** | - |
| `targetId` | string | **Yes** | - |
| `relationType` | string | No | `related` |
| `note` | string | No | `null` |

#### Delete Link

```http
DELETE /api/links/{id}
```

---

### Devices

Get connected WebSocket devices.

```http
GET /api/devices
```

**Response:**

```json
{
  "devices": [
    {
      "id": "clx5555555555",
      "deviceName": "iPhone 14 Pro",
      "deviceType": "mobile",
      "lastSeen": "2025-02-18T12:00:00.000Z",
      "connectedAt": "2025-02-18T10:00:00.000Z"
    },
    {
      "id": "clx6666666666",
      "deviceName": "Desktop Chrome",
      "deviceType": "desktop",
      "lastSeen": "2025-02-18T11:55:00.000Z",
      "connectedAt": "2025-02-18T09:00:00.000Z"
    }
  ]
}
```

---

### AI Endpoints

Capture Hub uses the z-ai-web-dev-sdk for AI-powered features.

#### AI Tag Suggestions

```http
POST /api/ai/suggestions
```

**Request Body:**

```json
{
  "content": "Project meeting notes about the new feature...",
  "title": "Feature planning"
}
```

**Response:**

```json
{
  "tags": ["project", "meeting", "planning", "feature"]
}
```

#### AI Content Summary

```http
POST /api/ai/summary
```

**Request Body:**

```json
{
  "content": "Long text content to summarize...",
  "maxLength": 200
}
```

**Response:**

```json
{
  "summary": "Concise summary of the content..."
}
```

#### AI Dashboard Insights

```http
GET /api/ai/insights
```

**Response:**

```json
{
  "insights": [
    {
      "type": "trend",
      "title": "Productivity up this week",
      "description": "You've processed 25% more items than last week"
    },
    {
      "type": "suggestion",
      "title": "Stale items detected",
      "description": "5 items in your inbox are over 7 days old"
    }
  ]
}
```

#### AI Semantic Connections

```http
POST /api/ai/connections
```

**Request Body:**

```json
{
  "itemId": "clx1234567890"
}
```

**Response:**

```json
{
  "connections": [
    {
      "itemId": "clx9876543210",
      "score": 0.85,
      "reason": "Similar tags and topic"
    }
  ]
}
```

#### AI GTD Processing Suggestion

```http
POST /api/ai/process-suggestion
```

**Request Body:**

```json
{
  "itemId": "clx1234567890",
  "context": {
    "currentStatus": "inbox",
    "tags": ["work", "urgent"]
  }
}
```

**Response:**

```json
{
  "suggestion": {
    "action": "assign",
    "target": "Project: Website Redesign",
    "reason": "Item relates to active project"
  }
}
```

#### Bulk AI Summary

```http
POST /api/ai/bulk-summary
```

**Request Body:**

```json
{
  "itemIds": ["clx1234567890", "clx9876543210"]
}
```

**Response:**

```json
{
  "summaries": {
    "clx1234567890": "Summary for item 1...",
    "clx9876543210": "Summary for item 2..."
  }
}
```

---

### Bookmarklet API

Capture web pages from external sites.

```http
POST /api/bookmarklet
```

**Request Body:**

```json
{
  "url": "https://example.com/article",
  "title": "Article Title",
  "selection": "Selected text content"
}
```

**Response:**

```json
{
  "success": true,
  "item": {
    "id": "clx7777777777",
    "type": "webpage",
    "title": "Article Title",
    "content": "Full extracted content...",
    "sourceUrl": "https://example.com/article",
    "tags": ["bookmarklet"],
    "status": "inbox"
  }
}
```

> **Note:** This endpoint has CORS enabled for bookmarklet usage.

---

### Inbox Operations

Special inbox management endpoints.

#### Assign Items

```http
POST /api/inbox/assign
```

**Request Body:**

```json
{
  "itemIds": ["id1", "id2"],
  "assignment": "Project: Website Redesign"
}
```

**Response:**

```json
{
  "success": true,
  "affected": 2
}
```

---

## WebSocket API

Capture Hub uses WebSockets for real-time synchronization across all connected devices.

### Connection

Connect to the WebSocket server:

```javascript
const ws = new WebSocket('ws://localhost:3000/ws');
```

### Connection Flow

1. **Client connects** → Server sends welcome message
2. **Client registers** → Sends device info
3. **Server broadcasts** → Notifies other devices
4. **Real-time updates** → Server broadcasts all data changes

### Client → Server Messages

#### Register Device

Send immediately after connection:

```json
{
  "type": "register",
  "data": {
    "deviceName": "iPhone 14 Pro",
    "deviceType": "mobile"
  }
}
```

`deviceType` options: `desktop`, `mobile`, `tablet`

#### Heartbeat/Ping

Keep connection alive:

```json
{
  "type": "ping"
}
```

Server responds with: `{"type": "pong"}`

### Server → Client Events

#### Welcome Message

Sent immediately after connection:

```json
{
  "type": "welcome",
  "data": {
    "message": "Connected to Capture Hub",
    "serverTime": "2025-02-18T12:00:00.000Z",
    "connectedDevices": 2
  }
}
```

#### Device Connected

New device joined:

```json
{
  "type": "device:connected",
  "data": {
    "deviceId": "clx8888888888",
    "deviceName": "iPhone 14 Pro",
    "deviceType": "mobile",
    "connectedAt": "2025-02-18T12:00:00.000Z"
  }
}
```

#### Device Disconnected

Device left:

```json
{
  "type": "device:disconnected",
  "data": {
    "deviceId": "clx8888888888",
    "deviceName": "iPhone 14 Pro",
    "disconnectedAt": "2025-02-18T12:05:00.000Z"
  }
}
```

#### Item Created

New item added:

```json
{
  "type": "item:created",
  "data": {
    "id": "clx9999999999",
    "type": "note",
    "title": "New note",
    "content": "Note content",
    "tags": ["tag1"],
    "status": "inbox",
    "priority": "none",
    "pinned": false,
    "createdAt": "2025-02-18T12:00:00.000Z",
    "updatedAt": "2025-02-18T12:00:00.000Z"
  }
}
```

#### Item Updated

Item modified:

```json
{
  "type": "item:updated",
  "data": {
    "id": "clx9999999999",
    "changes": {
      "status": "assigned",
      "tags": ["tag1", "tag2"]
    },
    "updatedAt": "2025-02-18T12:05:00.000Z"
  }
}
```

#### Item Deleted

Item removed:

```json
{
  "type": "item:deleted",
  "data": {
    "id": "clx9999999999",
    "deletedAt": "2025-02-18T12:10:00.000Z"
  }
}
```

#### Bulk Update

Multiple items changed:

```json
{
  "type": "item:bulk-update",
  "data": {
    "action": "update",
    "itemIds": ["id1", "id2", "id3"],
    "changes": {
      "status": "archived"
    },
    "updatedAt": "2025-02-18T12:15:00.000Z"
  }
}
```

#### Project Created

New project added:

```json
{
  "type": "project:created",
  "data": {
    "id": "clx0000000000",
    "name": "New Project",
    "color": "#6366f1",
    "status": "active",
    "createdAt": "2025-02-18T12:00:00.000Z"
  }
}
```

#### Stats Updated

Statistics changed:

```json
{
  "type": "stats:updated",
  "data": {
    "type": "capture",
    "timestamp": "2025-02-18T12:00:00.000Z"
  }
}
```

### Automatic Reconnection

Implement exponential backoff for reconnection:

```javascript
let reconnectAttempts = 0;
const maxReconnectDelay = 30000; // 30 seconds

ws.addEventListener('close', () => {
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), maxReconnectDelay);
  setTimeout(() => {
    reconnectAttempts++;
    // Reconnect logic
  }, delay);
});
```

---

## Best Practices

### 1. Pagination

Always use pagination for list endpoints:

```javascript
// Good
fetch('/api/capture?page=1&limit=20')

// Avoid - may return thousands of items
fetch('/api/capture?limit=1000')
```

### 2. AI Features

AI features run asynchronously. Handle updates via WebSocket:

```javascript
// Create item
const response = await fetch('/api/capture', { method: 'POST', body: ... });
const item = await response.json();

// Tags may be updated later via WebSocket
ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'item:updated' && msg.data.id === item.id) {
    // Tags updated by AI
  }
});
```

### 3. Search Optimization

Use `aiEnhanced=true` for better search results:

```javascript
fetch('/api/search?q=project&aiEnhanced=true')
```

### 4. Export Filtering

Use filters to export specific subsets:

```javascript
// Export only inbox notes
fetch('/api/export?format=json&status=inbox&type=note')
```

### 5. WebSocket Connection

Keep WebSocket connection alive with heartbeats:

```javascript
setInterval(() => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'ping' }));
  }
}, 30000); // Every 30 seconds
```

---

## Examples

### Create Item with AI Tagging

```javascript
const response = await fetch('/api/capture', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'note',
    title: 'Project planning meeting',
    content: 'Discussed Q1 roadmap and feature priorities...'
  })
});

const item = await response.json();
console.log('Created:', item.id);
// AI tags will be added asynchronously
```

### Search with AI Ranking

```javascript
const response = await fetch('/api/search?q=project&aiEnhanced=true&limit=10');
const { items, total } = await response.json();

items.forEach(item => {
  console.log(`${item.title} (rank: ${item.rank})`);
});
```

### Export to Markdown

```javascript
// Trigger browser download
window.location.href = '/api/export?format=markdown&status=inbox';
```

### Real-time Sync with WebSocket

```javascript
const ws = new WebSocket('ws://localhost:3000/ws');

ws.addEventListener('open', () => {
  // Register device
  ws.send(JSON.stringify({
    type: 'register',
    data: {
      deviceName: 'My Device',
      deviceType: 'desktop'
    }
  }));
});

ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data);

  switch (msg.type) {
    case 'item:created':
      // Add to UI
      break;
    case 'item:updated':
      // Update in UI
      break;
    case 'item:deleted':
      // Remove from UI
      break;
  }
});
```

---

## Changelog

### Version 1.0 (2025-02-18)

- Initial API documentation
- All REST endpoints documented
- WebSocket events documented
- Examples and best practices added

---

## Support

For API issues or questions:

- Open an issue on GitHub
- Check the [README.md](./README.md) for general documentation
- Review the troubleshooting section

---

**Last Updated:** 2025-02-18
