# Migration to Cloudflare Sandbox SDK

## Summary of Changes

This document summarizes the migration from direct Cloudflare Containers integration to using the Cloudflare Sandbox SDK.

### Key Changes

1. **Removed Components**:
   - Deleted `src/containers/vibekit-container.ts` (replaced by SDK's Sandbox class)
   - Removed `assets/command-server/` directory (SDK provides command server)
   - No longer need custom command server implementation

2. **Updated Components**:
   - `src/services/sandbox.ts`: Modified CloudflareSandboxProvider to use Sandbox SDK
   - `src/index.ts`: Export Sandbox from SDK instead of VibkitContainer
   - All Dockerfiles now use SDK base image (`docker.io/ghostwriternr/cloudflare-sandbox:0.0.5`)
   - Updated build script to not copy command server files
   - Updated example worker to use Sandbox binding
   - Updated documentation to reflect SDK usage

3. **New Dependencies**:
   - Added `@cloudflare/sandbox` package

### Benefits

1. **Less Code to Maintain**: Removed ~600 lines of custom code
2. **Better Features**: SDK provides file operations, git integration, session management
3. **Standardized**: Using official Cloudflare SDK patterns
4. **Future-Proof**: SDK will receive updates and improvements from Cloudflare

### Breaking Changes

1. **Binding Name**: Changed from `VIBEKIT_CONTAINER` to `Sandbox`
2. **Port Change**: Command server now runs on port 3000 (was 8080)
3. **Image Tags**: New images use `2.0-sdk` tag (was `1.0`)
4. **Class Export**: Export `Sandbox` instead of `VibkitContainer`

### Migration Steps for Users

1. Update dependencies:
   ```bash
   npm install @cloudflare/sandbox
   ```

2. Update wrangler.toml:
   ```toml
   [[containers]]
   class_name = "Sandbox"  # was "VibkitContainer"
   
   [[durable_objects.bindings]]
   name = "Sandbox"  # was "VIBEKIT_CONTAINER"
   class_name = "Sandbox"  # was "VibkitContainer"
   
   [[migrations]]
   tag = "v2"  # increment from previous
   new_sqlite_classes = ["Sandbox"]  # was ["VibkitContainer"]
   ```

3. Update worker code:
   ```typescript
   import { Sandbox } from '@cloudflare/sandbox';
   export { Sandbox };  // was export { VibkitContainer }
   
   // In config:
   binding: 'Sandbox'  // was 'VIBEKIT_CONTAINER'
   ```

4. Rebuild and deploy new container images with SDK base

### Implementation Notes

- The SDK's `exec()` method requires command and args to be separated
- Streaming uses SSE format instead of NDJSON
- Kill/pause operations not directly supported by SDK (would need DO-level implementation)
- Port forwarding needs different approach with SDK

### Next Steps

- Test the migration thoroughly
- Update any additional documentation
- Consider contributing improvements back to Sandbox SDK