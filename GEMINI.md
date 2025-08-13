# GEMINI.md

This document provides a comprehensive overview of the `mcp-remote` project, its purpose, and how to contribute to its development.

## Project Overview

`mcp-remote` is a command-line tool that acts as a proxy between a local Model Context Protocol (MCP) client and a remote MCP server. It enables clients that only support local (stdio) connections to communicate with remote servers that require OAuth for authentication. This project is written in TypeScript and uses Node.js for its runtime environment.

### Key Technologies

*   **TypeScript:** The primary language used for development.
*   **Node.js:** The runtime environment for the command-line tool.
*   **Express:** Used to create a local server for the OAuth callback.
*   **tsup:** Used for bundling the TypeScript code into distributable JavaScript.
*   **vitest:** Used for running unit tests.
*   **prettier:** Used for code formatting and ensuring a consistent style.

### Architecture

The project consists of two main components:

1.  **`proxy.ts`:** This is the main entry point for the `mcp-remote` command. It establishes a connection with the remote MCP server, handles the OAuth flow, and proxies the communication between the local client and the remote server.
2.  **`client.ts`:** This is a command-line client used for debugging and testing the connection to a remote MCP server. It allows developers to test the authentication and communication with the remote server without needing a full MCP client.

## Building and Running

### Prerequisites

*   Node.js (version 18 or higher)
*   pnpm (version 10.11.0 or higher)

### Installation

To install the dependencies, run the following command from the project's root directory:

```bash
pnpm install
```

### Building

To build the project, run the following command:

```bash
pnpm build
```

This command will compile the TypeScript code and output the JavaScript files to the `dist` directory.

### Running

The `mcp-remote` tool is designed to be run by an MCP client, as specified in the `README.md` file. However, for development and testing purposes, you can use the `mcp-remote-client` to connect to a remote server.

To run the client, use the following command:

```bash
npx -p . mcp-remote-client <remote-server-url>
```

Replace `<remote-server-url>` with the URL of the remote MCP server.

## Development Conventions

### Code Style

This project uses Prettier to enforce a consistent code style. Before committing any changes, make sure to run the following command to format your code:

```bash
pnpm lint-fix
```

To check for any formatting issues, run:

```bash
pnpm check
```

### Testing

Unit tests are written using `vitest`. All new features and bug fixes should be accompanied by corresponding tests.

To run the unit tests, use the following command:

```bash
pnpm test:unit
```

To run the tests in watch mode, use:

```bash
pnpm test:unit:watch
```

### Committing

This project follows the conventional commit message format. Please make sure your commit messages are descriptive and follow the standard.
