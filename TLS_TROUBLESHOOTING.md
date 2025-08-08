# TLS/DH Key Troubleshooting Guide

## Problem
You're encountering the error:
```
C05C3A18827F0000:error:0A00018A:SSL routines:tls_process_ske_dhe:dh key too small
```

This error occurs when OpenSSL rejects connections to SMTP servers that use weak Diffie-Hellman (DH) key sizes for security reasons.

## Solutions Implemented

### 1. Enhanced TLS Configuration
The application now uses multiple SMTP configurations to handle different server requirements:

- **Standard Config**: For modern SMTP servers (ports 465, 587)
- **Lenient Config**: For servers with older TLS configurations
- **Permissive Config**: For very old or problematic servers

### 2. Automatic Fallback
The mailer now automatically tries different configurations if the initial connection fails:

1. First tries the original SMTP configuration
2. If that fails, tries lenient configuration with broader cipher support
3. If that fails, tries permissive configuration with minimal security requirements

### 3. TLS Options Added
- `rejectUnauthorized: false` - Allows self-signed certificates
- `minVersion: 'TLSv1.2'` - Specifies minimum TLS version
- `ciphers: 'ALL:!aNULL:!ADH:!eNULL:!LOW:!EXP:RC4+RSA:+HIGH:+MEDIUM'` - Broad cipher support
- Connection timeouts to prevent hanging

## Configuration Files

### `config/smtp-config.js`
Contains helper functions for different SMTP configurations:
- `getStandardConfig()` - Standard secure configuration
- `getLenientConfig()` - Lenient configuration for problematic servers
- `getPermissiveConfig()` - Most permissive configuration
- `getAutoConfig()` - Auto-detects based on port

### Updated Files
- `routes/sendemails.js` - Now uses auto-configuration
- `workprocess/mailer.js` - Implements retry logic with fallback configurations

## Usage

The application will automatically handle TLS issues. If you're still experiencing problems:

1. **Check your SMTP server settings** - Ensure you're using the correct host, port, and credentials
2. **Try different ports** - Some servers work better on port 587 (STARTTLS) vs 465 (SSL)
3. **Enable debug mode** - Set `NODE_ENV=development` to see detailed connection logs

## Security Considerations

⚠️ **Warning**: The permissive configuration reduces security by:
- Allowing insecure connections (`secure: false`)
- Accepting all cipher suites (`ciphers: 'ALL'`)
- Disabling certificate verification (`rejectUnauthorized: false`)

Only use these settings if absolutely necessary and you trust your SMTP server.

## Alternative Solutions

If the automatic fallback doesn't work, you can:

1. **Contact your SMTP provider** - Ask them to upgrade their TLS configuration
2. **Use a different SMTP service** - Modern providers like SendGrid, Mailgun, or AWS SES have better TLS support
3. **Update your server's OpenSSL** - Ensure you're using a recent version

## Testing

To test if the fix works:
1. Restart your application
2. Try sending a test email
3. Check the logs for connection attempts and fallback messages
4. Monitor the email queue status for successful sends 