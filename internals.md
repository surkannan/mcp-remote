# MCP-Remote Internals

## Overview

MCP-Remote is a bidirectional proxy tool that bridges local STDIO and remote MCP (Model Context Protocol) servers using OAuth authentication. It enables local-only clients to connect to remote servers, handling the OAuth flow and message forwarding.

## Core Components

### Entry Points

1. **proxy.ts** - The main executable that creates a bidirectional proxy between:
   - Local STDIO MCP server for clients to connect to
   - Remote SSE (Server-Sent Events) server with OAuth authentication

2. **client.ts** - A standalone client that connects directly to MCP servers with OAuth authentication (primarily for testing)

### Library Components

#### OAuth Implementation (node-oauth-client-provider.ts)

- Implements the `OAuthClientProvider` interface for Node.js environments
- Handles client registration, token management, and authorization redirects
- Persists OAuth tokens, client information, and PKCE verifiers between sessions
- Opens a browser for user authorization when needed
- Supports token refresh for maintaining authenticated sessions

#### Bidirectional Proxy (utils.ts - mcpProxy)

- Creates a bidirectional message bridge between local and remote transports
- Forwards messages, errors, and close events in both directions
- Modifies client information in initialization messages to indicate it's coming through mcp-remote
- Handles graceful connection termination

#### Authentication Coordination (coordination.ts)

- Manages the OAuth authentication flow
- Uses file locks to prevent multiple instances from attempting authentication simultaneously
- Sets up an HTTP server to handle the OAuth callback
- Coordinates between multiple processes that might be using the same credentials

#### Configuration Management (mcp-auth-config.ts)

- Handles reading and writing of OAuth configuration files
- Manages client information, tokens, and PKCE verifiers
- Uses server URL hashing to create unique storage locations for each remote server

## Message Flow

1. A local client connects to the proxy's STDIO interface
2. Proxy authenticates with the remote server using OAuth if necessary
3. Messages from local client are forwarded to the remote server
4. Messages from remote server are forwarded back to the local client
5. Bidirectional communication is maintained until one side closes the connection

## OAuth Flow

1. OAuth client information is fetched or created for the remote server
2. PKCE code challenge and verifier are generated for secure token exchange
3. User is redirected to authorization URL in a browser
4. After authorization, browser redirects to local callback server
5. Authorization code is exchanged for access and refresh tokens
6. Tokens are stored for future use
7. Authenticated requests are made to the remote server using these tokens

## Debug Capabilities

The codebase includes built-in debugging capabilities:

- DEBUG flag to enable/disable verbose logging
- debugLog function for outputting detailed debug information
- Logging of message flows between local and remote endpoints
- Error handling with stack traces in debug mode
- HTTP request logging for debugging OAuth URL construction

### HTTP Logger

A dedicated HTTP interceptor (in `lib/http-interceptor.ts`) has been implemented to trace OAuth URL construction issues:

```typescript
// Enable debug mode with the --debug flag
npx tsx src/client.ts https://your-server.com/path --debug
```

The HTTP logger will show:

- All HTTP requests with methods and URLs
- Special detailed logging for OAuth-related URLs (containing 'oauth', '.well-known', etc.)
- Request headers (with sensitive information redacted)
- Response status codes for OAuth endpoints

Example log output:

```log
[HTTP-Request] GET https://example.com/calc/mcp
[OAuth-URL] https://example.com/.well-known/oauth-protected-resource
[OAuth-Headers] {"Accept":"application/json"}
[OAuth-Response] Status: 404 Not Found
```

#### OAuth URL Construction Issue

When using custom authorizers (e.g., example.com/oauth2/custom), the URLs can become malformed:

- Instead of correctly constructing: `example.com/oauth2/custom/v1/authorize`
- The tool may incorrectly use: `example.com/oauth2/default/oauth2/custom/v1/authorize`

Similar issues occur with `.well-known` discovery URLs.

This logger helps identify these problematic patterns and troubleshoot authentication issues with minimal code modifications.

## Potential Debugging Enhancements

Three potential approaches for enhancing debugging:

1. **Enable Built-in Debug Logging**
   - Use the existing DEBUG flag and debugLog function
   - Modify parseCommandLineArgs to make debug mode more accessible

2. **Patch the OAuth Client Provider**
   - Extend NodeOAuthClientProvider to add logging for specific OAuth endpoints
   - Focus on logging the `.well-known/openid-configuration` endpoint access

3. **Set up Network Logging**
   - Add network interceptors to log all HTTP requests
   - Filter for OAuth-related endpoints
   - Log request URLs, headers, and responses for troubleshooting
