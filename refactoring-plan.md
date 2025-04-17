# Auth Coordination Refactoring Plan

Currently, both `src/proxy.ts` and `src/client.ts` always run auth coordination before attempting to connect to the server. However, in some cases authentication is not required, and we already have the ability to catch and handle authorization errors in the `connectToRemoteServer` function.

The plan is to refactor the code so that auth coordination is only invoked when we actually receive an "Unauthorized" error, rather than preemptively setting up auth for all connections.

## Tasks

1. [x] **Create a lazy auth coordinator**: Modify `coordinateAuth` function to support lazy initialization, so we can set it up but only use it when needed.
   - Added `createLazyAuthCoordinator` function that returns an object with `initializeAuth` method
   - Kept original `coordinateAuth` function intact for backward compatibility
   
2. [x] **Refactor `connectToRemoteServer`**: Update this function to handle auth lazily:
   - Removed the `waitForAuthCode` and `skipBrowserAuth` parameters
   - Added a new `authInitializer` parameter that initializes auth when needed
   - Only call this initializer when we encounter an "Unauthorized" error
   - Created a new type `AuthInitializer` to define the expected interface

3. [x] **Update client.ts**: Refactor the client to use the new lazy auth approach.
   - No longer calling `coordinateAuth` at the beginning
   - Created function to initiate auth only when needed
   - Pass this function to `connectToRemoteServer`
   - Added proper handling of server cleanup
   
4. [x] **Update proxy.ts**: Similarly refactor the proxy to use the lazy auth approach.
   - No longer calling `coordinateAuth` at the beginning
   - Created function to initiate auth only when needed
   - Pass this function to `connectToRemoteServer`
   - Added proper handling of server cleanup

5. [ ] **Test both flows**:
   - Test with servers requiring authentication
   - Test with servers that don't require authentication

## Benefits

- Improved efficiency by avoiding unnecessary auth setup when not needed
- Faster startup for connections that don't require auth
- Cleaner separation of concerns
- Reduced complexity in the call flow