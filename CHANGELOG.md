# Changelog

All notable changes to VidScholar will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] - 2026-01-05

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

### Related Documentation

For more detailed information about this release, see:
- [Detailed Changelog](./docs/changelogs/2026-01-05.md) - Comprehensive v2.1.0 changes
- [Release Guide](./docs/guides/release.md) - Full release documentation
- [Development Roadmap](./docs/roadmap/development-roadmap.md) - Future plans

---

[2.1.0]: https://github.com/crrrowz/VidScholar/releases/tag/v2.1.0