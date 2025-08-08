/**
 * Render-specific SMTP Configuration
 * Handles the different OpenSSL/TLS environment on Render
 */

// Render-optimized SMTP configuration
function getRenderConfig(smtpHost, smtpPort, smtpUser, smtpPass) {
  const port = parseInt(smtpPort);
  
  // Base configuration
  const baseConfig = {
    host: smtpHost,
    port: port,
    auth: { user: smtpUser, pass: smtpPass },
    connectionTimeout: 60000,
    greetingTimeout: 30000,
    socketTimeout: 60000,
    debug: process.env.NODE_ENV === 'development',
    logger: process.env.NODE_ENV === 'development'
  };

  // Render-specific TLS handling
  if (port === 465) {
    // SSL port
    return {
      ...baseConfig,
      secure: true,
      tls: {
        rejectUnauthorized: false,
        minVersion: 'TLSv1',
        ciphers: 'ALL:!aNULL:!ADH:!eNULL:!LOW:!EXP:RC4+RSA:+HIGH:+MEDIUM'
      }
    };
  } else if (port === 587) {
    // STARTTLS port
    return {
      ...baseConfig,
      secure: false,
      tls: {
        rejectUnauthorized: false,
        minVersion: 'TLSv1',
        ciphers: 'ALL:!aNULL:!ADH:!eNULL:!LOW:!EXP:RC4+RSA:+HIGH:+MEDIUM'
      },
      requireTLS: false,
      ignoreTLS: false
    };
  } else {
    // Non-standard port - use most permissive
    return {
      ...baseConfig,
      secure: false,
      tls: {
        rejectUnauthorized: false,
        minVersion: 'TLSv1',
        ciphers: 'ALL'
      },
      requireTLS: false,
      ignoreTLS: true
    };
  }
}

// Ultra-permissive configuration for problematic servers on Render
function getRenderPermissiveConfig(smtpHost, smtpPort, smtpUser, smtpPass) {
  return {
    host: smtpHost,
    port: parseInt(smtpPort),
    secure: false,
    auth: { user: smtpUser, pass: smtpPass },
    tls: false, // Disable TLS completely
    connectionTimeout: 60000,
    greetingTimeout: 30000,
    socketTimeout: 60000,
    ignoreTLS: true,
    requireTLS: false,
    debug: true,
    logger: true
  };
}

// Configuration specifically for DH key issues on Render
function getRenderDHFixConfig(smtpHost, smtpPort, smtpUser, smtpPass) {
  return {
    host: smtpHost,
    port: parseInt(smtpPort),
    secure: parseInt(smtpPort) === 465,
    auth: { user: smtpUser, pass: smtpPass },
    tls: {
      rejectUnauthorized: false,
      minVersion: 'TLSv1',
      ciphers: 'ALL:!aNULL:!ADH:!eNULL:!LOW:!EXP:RC4+RSA:+HIGH:+MEDIUM',
      // Force specific DH parameters
      dhparam: null,
      // Disable DH key size checks
      honorCipherOrder: false
    },
    connectionTimeout: 60000,
    greetingTimeout: 30000,
    socketTimeout: 60000,
    ignoreTLS: false,
    requireTLS: false
  };
}

module.exports = {
  getRenderConfig,
  getRenderPermissiveConfig,
  getRenderDHFixConfig
}; 