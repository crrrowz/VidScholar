# Contributing to VidScholar

First off, thank you for considering contributing to VidScholar! Your help is greatly appreciated.

This document provides guidelines for contributing to the project. Please read it carefully to ensure a smooth development process for everyone.

## Understanding the Architecture

Before you start, it is crucial to read and understand the project's current architectural state, as detailed in [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

The key takeaway is that the project is in a **transitional phase**. You will find a mix of a modern, target architecture (DI, central store) and a legacy pattern (singleton services). When contributing, you should aim to follow the patterns of the **target architecture** whenever possible.

## Development Setup

Please refer to the [`docs/INSTALLATION.md`](./docs/INSTALLATION.md) for detailed instructions on how to set up your development environment.

A typical workflow is:

1.  Fork the repository.
2.  Clone your fork.
3.  Install dependencies with `npm install`.
4.  Run the development server with `npm run dev`.
5.  Load the extension in your browser.

## Making Changes

When making changes, please adhere to the following principles:

*   **Follow the Target Architecture:**
    *   If you are adding a new service, register it in the DI container.
    *   If you are working on a component, it should get its dependencies from the DI container or from props, not by directly importing a singleton.
    *   All state changes must go through the central store by dispatching actions.
*   **Code Style:** This project uses ESLint and Prettier to enforce a consistent code style.
    *   Before committing, run `npm run lint` and `npm run format` to check and fix your code.
    *   You can also set up your editor to format on save.
*   **Testing:**
    *   All new features should be accompanied by tests.
    *   Bug fixes should include a test that reproduces the bug and verifies the fix.
    *   Run the tests with `npm test`.

## Submitting a Pull Request

1.  Create a new branch for your feature or bug fix:
    ```bash
    git checkout -b my-feature-branch
    ```
2.  Make your changes, and ensure you follow the guidelines above.
3.  Commit your changes with a clear and descriptive commit message.
4.  Push your branch to your fork:
    ```bash
    git push origin my-feature-branch
    ```
5.  Open a pull request from your fork to the main VidScholar repository.
6.  In your pull request description, please explain the changes you have made and why. If it fixes an existing issue, please reference it.

## Code of Conduct

This project and everyone participating in it are governed by the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). By participating, you are expected to uphold this code. Please report unacceptable behavior.
