/**
 * POR - Project Orchestration and Reporting
 * Unified entry point for the application
 * 
 * This file replaces the redundant adapter files:
 * - framework.js
 * - MessageConveyor.js
 * - logger.js
 * - templateEngine.js
 */

// Re-export everything from the core module
module.exports = require('./src/core');
