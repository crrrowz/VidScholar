# Changelog

All notable changes to VidScholar will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-01-05

### 🎉 Major Release - Production Ready

This release marks VidScholar as production-ready with comprehensive features, cloud sync, and polished UI/UX.

### Added

#### Cloud Sync (Supabase)
- Real-time synchronization of notes and settings across devices
- Automatic sync on note creation, editing, and deletion
- Chrome Profile ID-based user identification (no login required)
- Rate limiting protection (100 requests/hour, 5000 notes max)

#### Floating Add Note Button
- New floating button on video player for quick note addition
- Smooth drag-and-drop positioning
- Delayed appearance (1.5s) for optimal performance
- Theme-aware styling with proper icon contrast

#### Inline Note Form
- In-player note creation without opening sidebar
- Template insertion support with dropdown
- Edit mode for existing notes
- Automatic transcript text insertion (when available)

#### Duplicate Note Detection
- Visual shake animation when adding note near existing one (10-second window)
- Auto-scroll to existing note
- Auto-focus textarea for immediate editing

### Changed

#### Button Styling
- Standardized button colors:
  - Cancel: Red (`btn--danger`)
  - Save: Blue (`btn--primary`)
  - Insert Template: Dynamic (default → primary on selection)

#### Theme System
- Added `primaryText` to ThemeColors for proper button icon contrast
- Added `icon`, `iconHover`, `delete` color properties

#### Animations
- Pre-loaded shake animation CSS for instant response
- Added `animate-shake` utility class

#### Note TextArea
- Added unique IDs based on timestamp (`note-textarea-{timestamp}`)
- Improved focus reliability with `focusNoteTextarea()` function

### Fixed

- Floating button icon color not adapting to theme changes
- Shake animation delay on first trigger
- Focus not working when editing existing notes
- Missing Arabic translation keys (`cancel`, `save`)
- Unused imports causing lint warnings

### Removed

- Confirmation dialog for duplicate notes (replaced with visual feedback)
- Unused `config` import from NoteTextArea.ts
- Unused `focusedElement` variable from NoteTextArea.ts
- Unused `themeService` and `showConfirmDialog` imports from MainToolbar.ts
- Unused `getStore` import from InlineNoteForm.ts

### Security

- Supabase Row Level Security (RLS) recommended for production
- Rate limiting configured for API protection
- Chrome User ID used for secure user identification

---

## [1.5.0] - 2025-12-15

### Added
- Video library management with drag-and-drop reordering
- Video group categorization
- Channel name extraction and persistence
- Screenshot download functionality

### Changed
- Improved sidebar responsiveness
- Enhanced note list performance

### Fixed
- Notes not saving correctly on video change
- Theme not persisting after browser restart

---

## [1.4.0] - 2025-11-20

### Added
- Template system with 5 preset groups
- Template editor modal
- Keyboard shortcut for quick note addition

### Changed
- Redesigned toolbar layout
- Improved template insertion UX

---

## [1.3.0] - 2025-10-15

### Added
- Full Arabic (RTL) language support
- Language switcher in settings
- RTL-aware component layouts

### Changed
- Internationalized all user-facing strings
- Updated LanguageService for dynamic locale switching

---

## [1.2.0] - 2025-09-01

### Added
- Dark/Light theme toggle
- Additional themes: Sepia, High Contrast, OLED
- CSS custom properties for consistent theming

### Changed
- Migrated to CSS variables for theme colors
- Improved contrast ratios for accessibility

---

## [1.1.0] - 2025-07-15

### Added
- Note import/export (JSON format)
- Full backup functionality
- Import decision manager for duplicate handling

### Changed
- Enhanced ExportService with multiple format support
- Improved ImportService error handling

---

## [1.0.0] - 2025-06-01

### 🎊 Initial Release

#### Features
- Timestamped note-taking synced with YouTube videos
- Click-to-jump navigation
- Auto-save with debouncing
- Undo/Redo support (50 actions)
- Chrome storage integration
- Share on X (Twitter) functionality
- Notes copy to clipboard

#### Technical
- TypeScript strict mode
- Redux-like state management
- WXT (Web Extension Tooling) framework
- Manifest V3 compliant

---

[2.1.0]: https://github.com/crrrowz/VidScholar/releases/tag/v2.1.0
[2.0.0]: https://github.com/crrrowz/VidScholar/releases/tag/v2.0.0
[1.5.0]: https://github.com/crrrowz/VidScholar/releases/tag/v1.5.0
[1.4.0]: https://github.com/crrrowz/VidScholar/releases/tag/v1.4.0
[1.3.0]: https://github.com/crrrowz/VidScholar/releases/tag/v1.3.0
[1.2.0]: https://github.com/crrrowz/VidScholar/releases/tag/v1.2.0
[1.1.0]: https://github.com/crrrowz/VidScholar/releases/tag/v1.1.0
[1.0.0]: https://github.com/crrrowz/VidScholar/releases/tag/v1.0.0