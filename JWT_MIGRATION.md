# Plex JWT Authentication Migration Guide

This guide explains how to migrate from the legacy Plex token authentication to the new JWT-based authentication system.

## What Changed

### New JWT Authentication System
- **Enhanced Security**: Uses ED25519 cryptographic signatures
- **Automatic Token Refresh**: Tokens refresh every 7 days automatically
- **Better Error Handling**: Clear error codes for different failure modes
- **Individual Device Control**: Each device can be managed separately

### Files Added/Modified
- `utils/plex-jwt.ts` - New JWT authentication service
- `utils/plex.ts` - Updated to use JWT tokens
- `hooks/usePlexJWT.ts` - React hooks for JWT state management
- `app/_layout.tsx` - Added JWT initialization
- `app.config.ts` - Added new environment variable
- `env.example` - Example configuration file

## Migration Steps

### 1. Update Environment Variables
Add the new `EXPO_PUBLIC_PLEX_CLIENT_ID` to your `.env` file:

```env
# Existing variables (keep these)
EXPO_PUBLIC_PLEX_SERVER=https://your-plex-server.com
EXPO_PUBLIC_PLEX_TOKEN=your-plex-token
EXPO_PUBLIC_PLEX_MUSIC_SECTION_ID=your-music-section-id

# New variable (add this)
EXPO_PUBLIC_PLEX_CLIENT_ID=your-unique-client-identifier
```

### 2. Generate a Unique Client ID
Create a unique identifier for your app. Examples:
- `yhplayer-ios-2024`
- `yhplayer-ios-${Date.now()}`
- `yhplayer-ios-${Math.random().toString(36).substr(2, 9)}`

### 3. First Run
The app will automatically:
1. Register your device's public key with Plex
2. Exchange your existing token for a JWT token
3. Store the JWT token securely
4. Use JWT tokens for all future requests

### 4. Verification
After the first run, you should see:
- Console log: "Plex JWT authentication initialized"
- No more authentication errors
- Automatic token refresh every 7 days

## How It Works

### Initial Setup (First Run)
1. App generates an ED25519 key pair
2. Registers the public key with Plex using your existing token
3. Gets a JWT token that's valid for 7 days
4. Stores everything securely in AsyncStorage

### Subsequent Runs
1. App loads the stored key pair and JWT token
2. Checks if the token needs refresh (expires in < 1 hour)
3. If needed, automatically refreshes the token
4. Uses the valid JWT token for all Plex requests

### Token Refresh Process
1. Get a nonce from Plex
2. Create a device JWT signed with your private key
3. Exchange the device JWT for a new Plex JWT token
4. Store the new token (valid for 7 days)

## Troubleshooting

### Common Issues

**"Failed to initialize Plex JWT"**
- Check your internet connection
- Verify your Plex server is accessible
- Ensure your existing token is still valid

**"JWK registration failed"**
- Your existing token may be expired
- Check if your Plex server supports JWT authentication
- Try clearing auth data and re-initializing

**"Token exchange failed"**
- Network connectivity issues
- Plex server temporarily unavailable
- Invalid client ID format

### Debug Commands

```typescript
import { plexJWTService, clearPlexAuth } from '@/utils/plex';

// Check if JWT is initialized
console.log('JWT initialized:', plexJWTService.isInitialized());

// Clear all auth data (for testing)
await clearPlexAuth();
```

### Reset Authentication
If you need to start over:
1. Clear app data or uninstall/reinstall
2. Or call `clearPlexAuth()` in your app
3. Restart the app to re-initialize

## Benefits

### Security Improvements
- **Short-lived tokens**: 7-day expiry vs. permanent tokens
- **Cryptographic signatures**: ED25519 instead of simple strings
- **Replay attack protection**: Nonce-based authentication
- **Individual device control**: Each device can be revoked separately

### Developer Experience
- **Automatic management**: No manual token refresh needed
- **Error handling**: Clear error messages for debugging
- **Familiar interface**: Same `X-Plex-Token` header usage
- **Backward compatibility**: Existing Plex API calls work unchanged

## Support

If you encounter issues:
1. Check the console logs for error messages
2. Verify your environment variables are correct
3. Ensure your Plex server is accessible
4. Try clearing auth data and re-initializing

The JWT system is designed to be robust and self-healing, but network issues or server problems can cause temporary failures.
