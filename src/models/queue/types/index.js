/**
 * Queue types module index
 * Exports all queue type implementations
 */

const BaseQueue = require('./BaseQueue');
const FifoQueue = require('./FifoQueue');
const PriorityQueue = require('./PriorityQueue');
const DelayedQueue = require('./DelayedQueue');

module.exports = {
  BaseQueue,
  FifoQueue,
  PriorityQueue,
  DelayedQueue
};
