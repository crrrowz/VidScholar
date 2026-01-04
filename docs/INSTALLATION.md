# Developer Setup and Installation Guide

This guide provides detailed instructions for setting up the VidScholar development environment. For a quick start, see the [README.md](../README.md).

## Prerequisites

*   **Node.js**: v18.0.0 or higher
*   **npm**: v9.0.0 or higher
*   **Git**

You can verify your versions by running `node --version` and `npm --version`.

## Installation and Development Workflow

1.  **Clone the Repository**
    ```bash
    git clone <repository-url>
    cd VidScholar-share-wxt
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Start the Development Server**
    ```bash
    npm run dev
    ```
    This command will build the extension and watch for file changes, automatically rebuilding the extension when you save a file.

4.  **Load the Unpacked Extension in Your Browser**

    *   **Chrome/Edge:**
        1.  Navigate to `chrome://extensions`.
        2.  Enable "Developer mode".
        3.  Click "Load unpacked".
        4.  Select the `.output/chrome-mv3` directory from the project root.

    *   **Firefox:**
        1.  Navigate to `about:debugging#/runtime/this-firefox`.
        2.  Click "Load Temporary Add-on...".
        3.  Select the `.output/firefox-mv3/manifest.json` file.

## Supabase Configuration

To enable Cloud Sync, you must configure Supabase and Chrome OAuth.

1.  **Create Supabase Project:**
    *   Create a new project at [supabase.com](https://supabase.com).
    *   Execute the SQL schema found in `supabase/schema.sql`.

2.  **Environment Variables:**
    *   Create `.env.local` in the root directory.
    *   Add your Supabase credentials:
        ```bash
        VITE_SUPABASE_URL=your_project_url
        VITE_SUPABASE_ANON_KEY=your_anon_key
        ```

3.  **Chrome OAuth Client ID:**
    *   Go to [Google Cloud Console](https://console.cloud.google.com/).
    *   Create a project and configure **OAuth consent screen**.
    *   Create credentials: **OAuth client ID** > **Chrome extension**.
    *   Add the extension ID (you can find it in `chrome://extensions` after loading the unpacked extension).
    *   Add the generic Key in your `manifest.json` under `oauth2` > `client_id`. Or use `key` property in manifest to keep consistent ID.

## Available Scripts

*   `npm run dev`: Starts the development server with live reloading.
*   `npm run build`: Creates a production-ready build of the extension.
*   `npm run test`: Runs the Jest unit tests.
*   `npm run e2e`: Runs the Playwright end-to-end tests.
*   `npm run lint`: Lints the code using ESLint.
*   `npm run format`: Formats the code using Prettier.
*   `npm run validate`: A combination script that runs linting, type-checking, and tests.

## Testing the Extension

A comprehensive testing setup is a core part of this project.

*   **Unit Tests (Jest):** To run the unit tests, use:
    ```bash
    npm test
    ```
    This will also generate a coverage report.

*   **End-to-End Tests (Playwright):** E2E tests run in a real browser. To execute them:
    ```bash
    npm run e2e
    ```
    A detailed HTML report will be generated in the `playwright-report` directory.

## Troubleshooting

*   **`npm install` fails:**
    *   Try clearing the npm cache: `npm cache clean --force`
    *   Delete `node_modules` and `package-lock.json`, then run `npm install` again.

*   **Extension not loading:**
    *   Ensure you are loading the correct directory (`.output/chrome-mv3`).
    *   Check the browser's extension console for any errors. In Chrome, this is available from the `chrome://extensions` page.
    *   Try a clean build by deleting the `.output` directory and running `npm run dev` again.

*   **Notes not saving:**
    *   Check that the extension has the `storage` permission in the manifest.
    *   As a last resort, you can clear the extension's storage from the browser's developer tools.

## Platform-Specific Notes

*   **Windows:** We recommend using PowerShell or Git Bash.
*   **macOS:** Ensure you have Xcode Command Line Tools installed.
*   **Linux:** Make sure you have the `build-essential` package (or equivalent) installed.
