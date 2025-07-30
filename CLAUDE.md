# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Build**: `pnpm build` (or `pnpm build:watch` for development)
- **Type check**: `pnpm check` (runs prettier and tsc)
- **Lint/Format**: `pnpm lint-fix` (prettier with write)
- **Test**: `pnpm test:unit` (or `pnpm test:unit:watch` for watch mode)
- **Run in development**:
  - Proxy: `npx tsx src/proxy.ts`
  - Client: `npx tsx src/client.ts`

## Project Architecture

This is a TypeScript ESM library that provides a remote proxy for the Model Context Protocol (MCP), enabling local-only clients to connect to remote servers using OAuth authentication.

### Core Components

- **Entry Points**:
  - `src/proxy.ts` - Main executable (`mcp-remote`) that creates a bidirectional proxy between local STDIO and remote SSE servers
  - `src/client.ts` - Standalone client (`mcp-remote-client`) for testing remote MCP servers with OAuth

- **Library Components** (`src/lib/`):
  - `node-oauth-client-provider.ts` - OAuth client implementation with token management and browser authorization
  - `coordination.ts` - Authentication flow coordination with file locking for multi-process safety
  - `mcp-auth-config.ts` - Configuration management for OAuth credentials and tokens
  - `utils.ts` - Core bidirectional proxy implementation (`mcpProxy` function)
  - `types.ts` - TypeScript interfaces for OAuth provider options and callback server setup
  - `http-logger.ts` - HTTP request logging for debugging OAuth flows

### Architecture Patterns

- **Transport Layer**: Supports both HTTP and SSE transports with automatic fallback strategies
- **Authentication**: OAuth 2.0 with PKCE, dynamic client registration, and token refresh
- **Configuration**: Uses `~/.mcp-auth/` directory for credential storage with server URL hashing
- **Message Flow**: Bidirectional proxy forwards messages between local STDIO clients and remote servers
- **Error Handling**: EventEmitter pattern for coordinating auth flows across processes

### Code Style

- ES modules with `.js` extensions for SDK imports
- Strict TypeScript with ES2022 target
- Prettier formatting (140 char width, single quotes, no semicolons)
- kebab-case for files, camelCase for variables/functions
- JSDoc for main functions, inline comments for complex auth flows

### Testing and Debugging

- Unit tests use Vitest framework
- Debug mode available with `--debug` flag for detailed OAuth flow logging
- HTTP logger traces OAuth URL construction issues
- Debug logs stored in `~/.mcp-auth/{server_hash}_debug.log`
