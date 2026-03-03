# 🎯 Capture Hub

**AI-Powered Personal Information Capture & Organization Hub**

Capture Hub is an intelligent command center for capturing, organizing, and processing information across all your devices. It features real-time sync, AI-powered auto-tagging, GTD workflow, and seamless multi-device support.

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)

## ✨ Features

### 🚀 Quick Capture
- **Fast Note Creation** - Capture thoughts instantly with title, content, and tags
- **AI Auto-Tagging** - Automatic tag suggestions powered by AI
- **Keyboard Shortcuts** - Press `Cmd/Ctrl+K` from anywhere to open Quick Capture
- **Real-time Broadcast** - New captures appear instantly on all connected devices

### 📝 Capture Modules

1. **Quick Capture** - Rapid note entry with minimal UI
2. **Scratchpad** - Extended markdown editor with live preview and auto-save
3. **OCR Tool** - Extract text from images using AI (VLM-based)
4. **Screenshot Capture** - Upload screenshots with optional notes
5. **Web Page Capture** - Save web content with bookmarklet support

### 🗂️ Organization

- **GTD Workflow** - Inbox → Processing → Projects/Tasks → Review → Archive
- **Projects** - Organize items into projects with colors and icons
- **Tags** - Flexible tagging system with AI-powered suggestions
- **Templates** - Reusable content templates for quick capture
- **Knowledge Graph** - Visualize connections between related items
- **Search** - Full-text search with AI-ranked results

### 🔄 Real-Time Sync

- **WebSocket Server** - Instant bidirectional sync across all devices
- **Device Presence** - See which devices are currently connected
- **Optimistic UI** - Updates appear immediately with server confirmation
- **Conflict Resolution** - Automatic last-write-wins with timestamp comparison

### 🤖 AI-Powered Features

- **Auto-Tagging** - Intelligent tag suggestions based on content
- **Search Ranking** - AI-enhanced search results
- **Content Summarization** - Generate summaries of long content
- **Processing Suggestions** - GTD workflow recommendations
- **Dashboard Insights** - Productivity analytics and trends
- **Semantic Connections** - Discover relationships between items

### 📊 Dashboard

- **Activity Stats** - Visual charts of captures, processing, and completions
- **Recent Activity** - Timeline of recent actions across devices
- **Quick Actions** - Fast access to common tasks
- **Analytics** - Detailed productivity insights

### 📱 Progressive Web App

- **Installable** - Add to home screen on mobile and desktop
- **Offline Support** - Service worker for offline access
- **App Shortcuts** - Quick launch shortcuts for key features
- **Responsive Design** - Beautiful UI on all screen sizes

## 🛠️ Technology Stack

### Frontend
- **Framework** - Next.js 16 (App Router) with React 19
- **Language** - TypeScript 5
- **Styling** - Tailwind CSS 4 with shadcn/ui (New York style)
- **Animations** - Framer Motion
- **Icons** - Lucide React
- **State** - React hooks with WebSocket sync
- **Markdown** - react-markdown with MDX editor
- **Notifications** - Sonner toast notifications

### Backend
- **Runtime** - Bun
- **Database** - SQLite via Prisma ORM
- **Real-time** - WebSocket server (native WS)
- **API** - Next.js API routes (REST)
- **AI** - z-ai-web-dev-sdk for OCR and AI features

### Testing
- **Unit Tests** - Vitest with React Testing Library
- **Integration Tests** - API and WebSocket tests
- **CI/CD** - GitHub Actions workflow

## 📋 Prerequisites

Before running Capture Hub, ensure you have:

- **Bun** - JavaScript runtime and package manager ([Install Bun](https://bun.sh))
- **Node.js 20+** - For Next.js compatibility
- **z-ai-web-dev-sdk API Key** - For AI features (optional - graceful degradation)

## 🚀 Getting Started

### 1. Clone and Install

```bash
# Clone the repository
git clone <your-repo-url>
cd capture-hub-project

# Install dependencies
bun install
```

### 2. Environment Setup

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your configuration
# At minimum, set:
# DATABASE_URL=file:./prisma/dev.db
# ZAI_API_KEY=your-api-key-here (optional)
```

### 3. Database Setup

```bash
# Generate Prisma client
bun run db:generate

# Push schema to database
bun run db:push
```

### 4. Start Development Server

```bash
# Start the development server (with WebSocket)
bun run dev

# Or start without WebSocket
bun run dev:simple
```

The app will be available at [http://localhost:3000](http://localhost:3000)

### 5. Build for Production

```bash
# Build the application
bun run build

# Start production server
bun start
```

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `DATABASE_URL` | SQLite database path | Yes | `file:./prisma/dev.db` |
| `PORT` | Server port | No | `3000` |
| `NEXT_PUBLIC_WS_URL` | WebSocket URL for clients | No | Auto-detected |
| `ZAI_API_KEY` | z-ai-web-dev-sdk API key | No* | - |
| `OPENAI_API_KEY` | OpenAI API key (alternative) | No* | - |

*AI features gracefully degrade if no API key is provided.

### Database Schema

Capture Hub uses the following Prisma models:

- **CaptureItem** - Notes, screenshots, OCR results, web captures
- **Project** - Projects for organizing items
- **Template** - Reusable content templates
- **ItemLink** - Connections between related items
- **ConnectedDevice** - Active WebSocket device connections

See `prisma/schema.prisma` for full schema details.

## 🎯 Usage Guide

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + K` | Open Quick Capture |
| `Cmd/Ctrl + N` | New Capture (alias) |
| `Cmd/Ctrl + F` | Focus Search |
| `Shift + ?` | Keyboard Shortcuts Help |
| `Escape` | Close active modal/dialog |
| `/` | Open Command Palette |
| `Arrow Keys` | Navigate FAB menu (when focused) |

### Capture Workflow

1. **Quick Capture** - Press `Cmd+K` and enter your note
2. **Auto-Tagging** - AI suggests tags based on content
3. **Organize** - Assign to projects, set priority, add due dates
4. **Process** - Use GTD workflow to move through inbox
5. **Link** - Connect related items in knowledge graph
6. **Archive** - Archive completed items when done

### GTD Workflow

The GTD (Getting Things Done) implementation:

1. **Inbox** - All new captures arrive here
2. **Processing** - Review and categorize each item
3. **Projects** - Multi-step outcomes
4. **Tasks** - Single actionable items
5. **Review** - Weekly review of all projects
6. **Archive** - Completed items for reference

### Multi-Device Sync

All devices connected to the same Capture Hub instance sync in real-time:

1. Open Capture Hub on multiple devices
2. See connected devices in header indicator
3. Changes appear instantly on all devices
4. Automatic reconnection on network changes

## 🔌 API Reference

### Health Check
```
GET /api/health
```

### Capture Items
```
GET    /api/capture          # List all items
POST   /api/capture          # Create new item
GET    /api/capture/[id]     # Get single item
PUT    /api/capture/[id]     # Update item
DELETE /api/capture/[id]     # Delete item
POST   /api/capture/bulk     # Bulk operations
```

### Projects
```
GET    /api/projects         # List all projects
POST   /api/projects         # Create project
GET    /api/projects/[id]    # Get project details
PUT    /api/projects/[id]    # Update project
DELETE /api/projects/[id]    # Delete project
```

### Search
```
GET /api/search?q=query&type=note&tags=tag1,tag2
```

### Export
```
GET /api/export?format=json&status=inbox
GET /api/export?format=markdown
GET /api/export?format=csv
```

### WebSocket
```
WS /ws
```

**WebSocket Events:**
- `device:connected` - New device joined
- `device:disconnected` - Device left
- `item:created` - New item added
- `item:updated` - Item modified
- `item:deleted` - Item removed
- `item:bulk-update` - Bulk operation completed

## 🧪 Testing

```bash
# Run all tests
bun run test

# Run tests with UI
bun run test:ui

# Run tests once
bun run test:run

# Generate coverage report
bun run test:coverage
```

## 📁 Project Structure

```
capture-hub-project/
├── prisma/
│   └── schema.prisma          # Database schema
├── public/
│   ├── sw.js                  # Service worker
│   └── manifest.json          # PWA manifest
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── api/               # API routes
│   │   ├── bookmarklet/       # Bookmarklet page
│   │   └── page.tsx           # Main app page
│   ├── components/
│   │   ├── CaptureModules/    # Capture UI components
│   │   ├── Dashboard/         # Dashboard components
│   │   ├── GTD/               # GTD workflow components
│   │   ├── Header/            # App header
│   │   ├── Inbox/             # Inbox list components
│   │   ├── Projects/          # Project management
│   │   ├── Templates/         # Template management
│   │   └── ui/                # shadcn/ui components
│   ├── contexts/              # React contexts
│   ├── hooks/                 # Custom React hooks
│   ├── lib/                   # Utility functions
│   └── test/                  # Test files and fixtures
├── .env.example               # Environment variables template
├── next.config.ts             # Next.js configuration
├── tailwind.config.ts         # Tailwind CSS configuration
├── tsconfig.json              # TypeScript configuration
└── package.json               # Dependencies and scripts
```

## 🌐 Deployment

### Deployment Checklist

1. **Set Production Environment Variables**
   ```bash
   DATABASE_URL=<production-db-path>
   NODE_ENV=production
   ```

2. **Build the Application**
   ```bash
   bun run build
   ```

3. **Start Production Server**
   ```bash
   bun start
   ```

### Deployment Platforms

Capture Hub can be deployed to any platform supporting Node.js/Bun:

- **Vercel** - Recommended for Next.js apps
- **Railway** - Simple deployment with built-in database
- **Fly.io** - Global edge deployment
- **Self-hosted** - Any VPS or cloud provider

### WebSocket Considerations

When deploying, ensure:
- WebSocket connections are allowed (no proxy blocking)
- Proper `NEXT_PUBLIC_WS_URL` is set for production
- Sticky sessions are configured if using multiple server instances

## 🚀 Production Deployment

For production deployment with Docker and CI/CD, see the comprehensive **[DEPLOYMENT.md](DEPLOYMENT.md)** guide.

Quick production deployment:

```bash
# Clone and configure
git clone <repo-url> capture-hub && cd capture-hub
cp .env.production.template .env

# Start container
docker compose -f docker-compose.production.yml up -d
docker exec capture-hub bun run db:push

# Verify
curl http://localhost:3000/api/health
```

**Production features:**
- ✅ Docker containerization with multi-stage build
- ✅ GitHub Actions CI/CD pipeline
- ✅ Automated backups and deployment scripts
- ✅ nginx reverse proxy with SSL/TLS
- ✅ Health checks and monitoring
- ✅ Database persistence across restarts

See [DEPLOYMENT.md](DEPLOYMENT.md) for complete instructions.

## 🔧 Troubleshooting

### Database Issues

```bash
# Reset database (WARNING: Deletes all data)
bun run db:reset

# Regenerate Prisma client
bun run db:generate
```

### WebSocket Connection Issues

1. Check browser console for WebSocket errors
2. Verify `NEXT_PUBLIC_WS_URL` is correct
3. Ensure no firewall/proxy blocking WebSocket connections
4. Check server logs for connection errors

### AI Features Not Working

1. Verify `ZAI_API_KEY` is set in `.env`
2. Check API key is valid and has credits
3. AI features gracefully degrade - check console for fallback messages

### Build Errors

```bash
# Clear Next.js cache
rm -rf .next

# Clear node_modules and reinstall
rm -rf node_modules bun.lockb
bun install
```

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines on:

- Code style and conventions
- Development setup
- Feature creation process
- Testing requirements
- Pull request review process

Quick start:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests and linting (`bun run lint && bun run test:run`)
5. Submit a pull request

## 📧 Support

For issues, questions, or suggestions:

- Open an issue on GitHub
- Check existing documentation
- Review the troubleshooting section

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Icons by [Lucide](https://lucide.dev/)
- AI features powered by [z-ai-web-dev-sdk](https://z.ai/)

---

**Built with ❤️ for personal productivity**
