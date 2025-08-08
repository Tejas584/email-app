/**
 * SMTP Configuration Helper
 * Provides different SMTP configurations to handle various TLS/DH key issues
 */

// Standard SMTP configuration
function getStandardConfig(smtpHost, smtpPort, smtpUser, smtpPass) {
  return {
    host: smtpHost,
    port: parseInt(smtpPort),
    secure: parseInt(smtpPort) === 465,
    auth: { user: smtpUser, pass: smtpPass },
    tls: {
      rejectUnauthorized: false,
      minVersion: 'TLSv1.2'
    },
    connectionTimeout: 60000,
    greetingTimeout: 30000,
    socketTimeout: 60000
  };
}

// Lenient SMTP configuration for problematic servers
function getLenientConfig(smtpHost, smtpPort, smtpUser, smtpPass) {
  return {
    host: smtpHost,
    port: parseInt(smtpPort),
    secure: parseInt(smtpPort) === 465,
    auth: { user: smtpUser, pass: smtpPass },
    tls: {
      rejectUnauthorized: false,
      minVersion: 'TLSv1',
      ciphers: 'ALL:!aNULL:!ADH:!eNULL:!LOW:!EXP:RC4+RSA:+HIGH:+MEDIUM'
    },
    connectionTimeout: 60000,
    greetingTimeout: 30000,
    socketTimeout: 60000,
    debug: process.env.NODE_ENV === 'development',
    logger: process.env.NODE_ENV === 'development'
  };
}

// Most permissive configuration for very old servers
function getPermissiveConfig(smtpHost, smtpPort, smtpUser, smtpPass) {
  return {
    host: smtpHost,
    port: parseInt(smtpPort),
    secure: false, // Force non-secure for problematic servers
    auth: { user: smtpUser, pass: smtpPass },
    tls: {
      rejectUnauthorized: false,
      minVersion: 'TLSv1',
      ciphers: 'ALL'
    },
    connectionTimeout: 60000,
    greetingTimeout: 30000,
    socketTimeout: 60000,
    debug: process.env.NODE_ENV === 'development',
    logger: process.env.NODE_ENV === 'development'
  };
}

// Auto-detect configuration based on port
function getAutoConfig(smtpHost, smtpPort, smtpUser, smtpPass) {
  const port = parseInt(smtpPort);
  
  // For standard secure ports, use standard config
  if (port === 465 || port === 587) {
    return getStandardConfig(smtpHost, smtpPort, smtpUser, smtpPass);
  }
  
  // For non-standard ports, use lenient config
  return getLenientConfig(smtpHost, smtpPort, smtpUser, smtpPass);
}

module.exports = {
  getStandardConfig,
  getLenientConfig,
  getPermissiveConfig,
  getAutoConfig
}; 