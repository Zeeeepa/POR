/**
 * Framework adapter for backward compatibility
 * This file directly exports DeplaEnhanced from src/models/DeplaEnhanced.js
 * instead of using the unified framework from src/framework/index.js
 */

// Import DeplaEnhanced
const DeplaEnhanced = require('./src/models/DeplaEnhanced');

// Export DeplaEnhanced as the main framework component
module.exports = {
  DeplaEnhanced,
  // Re-export other components for backward compatibility
  ...require('./src/framework')
};
