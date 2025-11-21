# VidScholar Architecture

This document provides a detailed overview of the VidScholar browser extension's architecture. It is intended for developers contributing to the project.

## Architectural State

VidScholar is currently in a **transitional architectural state**. A major refactor was undertaken to introduce modern development patterns like centralized state management and dependency injection. However, this transition is not yet complete.

As a result, the codebase contains a mix of two patterns:

1.  **The Target Architecture:** Using a central store, dependency injection, and well-defined services.
2.  **The Legacy Pattern:** Using direct imports of singleton services and manual state management.

This document describes the **current state** of the architecture, making note of both patterns.

## Core Components

### 1. Entry Points

The extension has two main entry points:

*   **`entrypoints/content.ts`**: This is the heart of the application's user-facing functionality. It runs in the context of YouTube watch pages and is responsible for:
    *   Initializing all core services.
    *   Creating the central state store.
    *   Injecting the note-taking sidebar into the YouTube UI.
    *   Listening to YouTube navigation events to re-initialize the sidebar on new video pages.

*   **`entrypoints/background.ts`**: This script runs in the background and has a minimal role. Its primary responsibility is to monitor browser tabs and send a message to the `content.ts` script when a user navigates to a YouTube video.

### 2. User Interface

The UI, primarily the sidebar and its components, is built using **vanilla TypeScript** with direct DOM manipulation.

*   The main sidebar is created in `src/components/sidebar/Sidebar.ts`.
*   UI components are organized in `src/components/`.
*   Although the build system is configured for React (`wxt.config.ts`), React is **not currently used** for rendering the main extension UI.

### 3. State Management

The project uses a custom, Redux-like **centralized state store**, defined in `src/state/Store.ts`.

*   **Single Source of Truth:** The store holds the entire application state, including notes, templates, and UI status.
*   **Immutable State:** The state is immutable and can only be updated by dispatching actions.
*   **Actions:** Actions are defined in `src/state/actions.ts`. They are functions that encapsulate state changes.
*   **Initialization:** The store is created and initialized in `entrypoints/content.ts`.

### 4. Services

Services are responsible for specific domains of functionality. They are found in `src/services/`. Due to the transitional architecture, there are two ways services are managed:

#### Dependency Injection Container

The target architecture uses a DI container (`src/services/di/Container.ts`) to manage service instances. The intention is for all services to be registered in `src/services/di/services.ts` and resolved by the container. This pattern is **not yet fully adopted**.

#### Singleton Services (Direct Import)

The most common pattern currently in use is the singleton pattern. Services are instantiated as singletons and exported directly from their modules. Other parts of the application then import these instances directly.

Examples of singleton services:

*   `noteStorage` (`src/classes/NoteStorage.ts`)
*   `themeService` (`src/services/ThemeService.ts`)
*   `languageService` (`src/services/LanguageService.ts`)
*   `settingsService` (`src/services/SettingsService.ts`)

### 5. Unused Features: Backup & Encryption

The codebase includes a `BackupService` and an `EncryptionService`.

*   `src/services/BackupService.ts`: Implements functionality for creating and restoring encrypted backups of user notes.
*   `src/services/EncryptionService.ts`: Provides AES-256-GCM encryption and is used by the `BackupService`.

**Important:** While these services are implemented and have unit tests, they are **not currently integrated into the application**. There is no UI or user-facing feature that uses them.

## Data Flow

1.  A user navigates to a YouTube video.
2.  The `background.ts` script detects this and messages `content.ts`.
3.  The `content.ts` script initializes services and the state store.
4.  `content.ts` reads notes for the current video from `NoteStorage`.
5.  `content.ts` creates the sidebar UI.
6.  User interactions in the sidebar (e.g., adding a note) dispatch actions to the store.
7.  The store updates its state.
8.  A store subscription in `content.ts` is triggered, which then updates the sidebar UI to reflect the new state.
9.  An auto-save mechanism persists the updated notes back to storage.

## Future Direction

The intended direction for the project is to complete the transition to the new architecture:

*   Migrate all UI components to React.
*   Refactor all services to be managed by the DI container.
*   Eliminate the direct-import singleton pattern.
*   Integrate the `BackupService` to provide backup and restore functionality.
