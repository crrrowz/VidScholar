# VidScholar

> **Transform YouTube into Your Personal Learning Platform**

<p align="center">
  <img src="public/icon-128.png" alt="VidScholar Logo" width="128" height="128">
</p>

<p align="center">
  <strong>Version 2.1.0</strong> · 
  <strong>Manifest V3</strong> · 
  <strong>Chrome & Firefox</strong> ·
  <strong>Cloud Sync Ready</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#development">Development</a> •
  <a href="#documentation">Documentation</a>
</p>

---

## Overview

**VidScholar** is a production-grade browser extension that converts passive video watching into active learning. Take timestamped notes synced with YouTube playback, organise knowledge with templates, and revisit insights instantly.

```
┌─────────────────────────────────────────────────────────────┐
│                     YOUTUBE + VIDSCHOLAR                     │
│  ┌─────────────────────────────┬───────────────────────────┐│
│  │                             │  📝 VidScholar Sidebar    ││
│  │      YouTube Video          │  ┌─────────────────────┐  ││
│  │                             │  │ 🕐 1:30 - Key point │  ││
│  │       ▶ Playing...          │  │ 🕐 3:45 - Important │  ││
│  │                             │  │ 🕐 5:12 - Summary   │  ││
│  │                             │  └─────────────────────┘  ││
│  └─────────────────────────────┴───────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

## Features

| Feature | Description |
|---------|-------------|
| **⏱️ Timestamped Notes** | Create notes linked to specific video moments. Click to jump instantly. |
| **📝 Note Management** | Full CRUD operations — add, edit, delete, and organise notes. |
| **📋 Template System** | Customisable templates for rapid structured note-taking. |
| **📚 Video Library** | Persistent catalog of all videos with your annotations. |
| **💾 Auto-Save** | Notes automatically saved during editing (debounced). |
| **↩️ Undo/Redo** | 50-action history for state recovery. |
| **🎨 Multiple Themes** | Light, Dark, Sepia, High-Contrast, OLED. |
| **🌍 Localisation** | Full support for English and Arabic (RTL). |
| **🔐 Encryption** | AES-256-GCM encryption for backups (PBKDF2 key derivation). |
| **☁️ Cloud Sync** | Real-time synchronization of notes and settings via Supabase. |
| **📤 Export/Import** | Export notes as JSON or Markdown. Full backup support. |

---

## Quick Start

### Prerequisites

| Requirement | Version |
|-------------|---------|
| Node.js | v18.0.0+ |
| npm | v9.0.0+ |

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/crrrowz/VidScholar.git
cd VidScholar

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev
```

### Load Extension in Browser

**Chrome:**
1. Navigate to `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select folder: `.output/chrome-mv3`

**Firefox:**
1. Navigate to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Select any file in: `.output/firefox-mv3`

---

## Architecture

VidScholar follows a modern, enterprise-grade architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                       │
│         Vanilla TypeScript + DOM Manipulation               │
├─────────────────────────────────────────────────────────────┤
│                      STATE LAYER                            │
│           Redux-like Store • Undo/Redo • Subscriptions      │
├─────────────────────────────────────────────────────────────┤
│                     SERVICE LAYER                           │
│     Theme • Language • Storage • Backup • Encryption        │
│              DI Container (Singleton/Transient)             │
├─────────────────────────────────────────────────────────────┤
│                    PLATFORM LAYER                           │
│           chrome.storage • chrome.runtime • MV3             │
└─────────────────────────────────────────────────────────────┘
```

### Key Architectural Patterns

| Pattern | Implementation |
|---------|----------------|
| **State Management** | Custom Redux-like immutable store (`src/state/Store.ts`) |
| **Dependency Injection** | Service container with lifecycle management (`src/services/di/Container.ts`) |
| **Separation of Concerns** | UI components contain no business logic |
| **Type Safety** | TypeScript strict mode, zero `any` types |

### Project Structure

```
VidScholar/
├── entrypoints/              # Extension entry points
│   ├── content.ts            # Main UI injection (YouTube pages)
│   └── background.ts         # Service worker (tab monitoring)
│
├── src/
│   ├── components/           # UI components (sidebar, notes, toolbar)
│   ├── services/             # Business logic (theme, language, storage)
│   │   └── di/               # Dependency injection container
│   ├── state/                # State management (Store, actions)
│   ├── classes/              # Core domain classes (NoteStorage)
│   ├── types/                # TypeScript definitions
│   └── utils/                # Utility functions
│
├── tests/                    # Jest unit tests & Playwright E2E
├── docs/                     # Architecture & implementation guides
└── public/                   # Static assets & i18n files
```

---

## Development

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development with hot reload |
| `npm run build` | Production build for Chrome |
| `npm run build:firefox` | Production build for Firefox |
| `npm run zip` | Create distribution package |
| `npm run lint` | Run ESLint checks |
| `npm run lint:fix` | Auto-fix lint issues |
| `npm run type-check` | TypeScript verification |
| `npm run test` | Run Jest unit tests |
| `npm run e2e` | Run Playwright E2E tests |
| `npm run validate` | Full validation pipeline |

### Code Quality

```bash
# Run full validation before committing
npm run validate

# This runs:
# 1. ESLint (zero warnings allowed)
# 2. TypeScript type checking
# 3. Jest unit tests with coverage
```

### Testing

```bash
# Unit tests
npm run test              # Run all tests
npm run test:watch        # Watch mode

# E2E tests
npm run e2e               # Headless
npm run e2e:ui            # Interactive UI
npm run e2e:debug         # Debug mode
```

**Coverage Targets:**
- Branches: 80%+
- Functions: 80%+
- Lines: 80%+
- Statements: 80%+

---

## Documentation

> 📚 All technical documentation is organized in the [`/docs`](./docs) folder.
> Start with the [**Documentation Index**](./docs/README.md) for a complete overview.

### Quick Links

| Category | Key Documents |
|----------|---------------|
| **Architecture** | [Overview](./docs/architecture/overview.md) · [Complete Design](./docs/architecture/complete-design.md) · [Cloud Sync](./docs/architecture/cloud-sync.md) |
| **Roadmaps** | [Development Roadmap](./docs/roadmap/development-roadmap.md) · [Remote Config](./docs/roadmap/remote-config-roadmap.md) |
| **Guides** | [Installation](./docs/guides/installation.md) · [Implementation](./docs/guides/implementation-guide.md) · [Release](./docs/guides/release.md) |
| **Refactoring** | [Refactoring Analysis](./docs/refactoring/README.md) - 15 improvement zones |
| **Decisions** | [ADRs](./docs/decisions/) - Architectural Decision Records |
| **Contributing** | [CONTRIBUTING.md](./CONTRIBUTING.md) · [CHANGELOG.md](./CHANGELOG.md) |

---

## 🔧 Technology Stack

| Layer | Technology |
|-------|------------|
| **Language** | TypeScript (strict mode) |
| **Framework** | WXT (Web Extension Tooling) |
| **UI** | Vanilla TypeScript + DOM |
| **Styling** | Custom CSS with Design Tokens |
| **State** | Custom Redux-like store |
| **DI** | Custom container |
| **Testing** | Jest + Playwright |
| **Quality** | ESLint + Prettier + Husky |
| **Cloud Sync** | Supabase (PostgreSQL) |
| **Platform** | Chrome & Firefox (Manifest V3) |

---

## 🔐 Security

VidScholar implements enterprise-grade security:

| Feature | Implementation |
|---------|----------------|
| **Encryption** | AES-256-GCM |
| **Key Derivation** | PBKDF2 (100,000 iterations) |
| **Backup Protection** | Optional password encryption |
| **Minimal Permissions** | Only `storage` permission required |
| **No Remote Code** | All code bundled locally |

---

## 🔄 Architectural Status

> **Note:** VidScholar is currently in a **transitional architectural phase** following a major refactor.

### Current State

The codebase contains a mix of two patterns:

1. **Target Architecture (New)**
   - Centralized Redux-like state store
   - Dependency injection container
   - Well-defined services with clear contracts

2. **Legacy Pattern (Being Migrated)**
   - Direct-import singleton services
   - Manual state management

### Future Roadmap

- [ ] Complete migration to React for UI components
- [ ] Full adoption of DI container for all services
- [ ] UI integration of Backup & Encryption features
- [ ] Achieve 80%+ test coverage across codebase
- [ ] Performance optimization and monitoring

---

## 🗺️ Roadmap

### Current: v2.1.0 (Production Release) ✅

- [x] Redux-like state management
- [x] Dependency injection container
- [x] TypeScript strict mode
- [x] Testing infrastructure
- [x] Encryption & backup services
- [x] Cloud sync support (Supabase)
- [x] Floating add note button
- [x] Inline note form
- [x] Full Arabic (RTL) support

### Upcoming: v2.1.0

- [ ] Additional export formats (PDF, HTML)
- [ ] Note search functionality
- [ ] Improved video library filtering
- [ ] Performance optimizations

### Future: v3.0.0

- [ ] React UI migration
- [ ] Plugin system
- [ ] AI-powered summarization
- [ ] Cross-browser sync

---

## 🤝 Contributing

We welcome contributions! Please see our [**CONTRIBUTING.md**](./CONTRIBUTING.md) for:

- Development workflow
- Coding conventions
- Pull request guidelines
- Code review process

### Quick Contribution Guide

```bash
# 1. Fork and clone
git clone https://github.com/YOUR_USERNAME/VidScholar.git

# 2. Create feature branch
git checkout -b feature/your-feature-name

# 3. Make changes and validate
npm run validate

# 4. Commit with conventional commits
git commit -m "feat: add new feature"

# 5. Push and create PR
git push origin feature/your-feature-name
```

---

## 📄 License

Copyright (c) 2024 VidScholar.

This project is licensed for **DEVELOPMENT USE ONLY**.
**Commercial use is strictly prohibited.**

See the [LICENSE](./LICENSE) file for full details.

---

<p align="center">
  Built with ❤️ for learners everywhere
</p>

<p align="center">
  <strong>VidScholar</strong> — Transform how you learn from YouTube
</p>
