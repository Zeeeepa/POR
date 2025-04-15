/**
 * MessageQueueSystem.test.js
 * Tests for the MessageQueueSystem implementation
 */

const MessageQueueSystem = require('../src/models/MessageQueueSystem');

// Basic test to verify the system can be instantiated
describe('MessageQueueSystem', () => {
  let queueSystem;

  beforeEach(() => {
    // Create a new queue system for each test
    queueSystem = new MessageQueueSystem({
      storageType: 'memory',
      autoStart: false
    });
  });

  afterEach(async () => {
    // Clean up after each test
    if (queueSystem) {
      queueSystem.cleanup();
    }
  });

  test('should create a new queue system', () => {
    expect(queueSystem).toBeInstanceOf(MessageQueueSystem);
  });

  test('should create a queue', async () => {
    const queue = await queueSystem.createQueue('test-queue');
    expect(queue).toBeDefined();
    
    const queues = await queueSystem.listQueues();
    expect(queues).toContain('test-queue');
  });

  test('should create different queue types', async () => {
    const fifoQueue = await queueSystem.createQueue('fifo-queue', { type: 'fifo' });
    const priorityQueue = await queueSystem.createQueue('priority-queue', { type: 'priority' });
    const delayedQueue = await queueSystem.createQueue('delayed-queue', { type: 'delayed' });
    
    expect(fifoQueue.constructor.name).toBe('FifoQueue');
    expect(priorityQueue.constructor.name).toBe('PriorityQueue');
    expect(delayedQueue.constructor.name).toBe('DelayedQueue');
  });

  test('should send and receive messages', async () => {
    // Create a queue
    await queueSystem.createQueue('test-queue');
    
    // Send a message
    const messageId = await queueSystem.sendMessage('test-queue', 'Hello, world!');
    expect(messageId).toBeDefined();
    
    // Receive the message
    const messages = await queueSystem.receiveMessages('test-queue');
    expect(messages.length).toBe(1);
    expect(messages[0].body).toBe('Hello, world!');
  });

  test('should acknowledge messages', async () => {
    // Create a queue
    await queueSystem.createQueue('test-queue');
    
    // Send a message
    const messageId = await queueSystem.sendMessage('test-queue', 'Hello, world!');
    
    // Receive the message
    const messages = await queueSystem.receiveMessages('test-queue');
    
    // Acknowledge the message
    const result = await queueSystem.acknowledgeMessage('test-queue', messageId);
    expect(result).toBe(true);
    
    // Try to receive again, should be empty
    const emptyMessages = await queueSystem.receiveMessages('test-queue');
    expect(emptyMessages.length).toBe(0);
  });

  test('should set up dead letter queue', async () => {
    // Create source and dead letter queues
    await queueSystem.createQueue('source-queue');
    await queueSystem.createQueue('dlq-queue');
    
    // Set up dead letter queue
    const result = await queueSystem.setDeadLetterQueue('source-queue', 'dlq-queue');
    expect(result).toBe(true);
    
    // Verify in queue attributes
    const attributes = await queueSystem.getQueueAttributes('source-queue');
    expect(attributes.deadLetterQueue).toBe('dlq-queue');
  });

  test('should move messages to dead letter queue', async () => {
    // Create source and dead letter queues
    await queueSystem.createQueue('source-queue');
    await queueSystem.createQueue('dlq-queue');
    
    // Set up dead letter queue
    await queueSystem.setDeadLetterQueue('source-queue', 'dlq-queue');
    
    // Send a message to source queue
    const messageId = await queueSystem.sendMessage('source-queue', 'Failed message');
    
    // Move to dead letter queue
    const result = await queueSystem.deadLetterMessage('source-queue', messageId, 'Test failure');
    expect(result).toBe(true);
    
    // Source queue should be empty
    const sourceMessages = await queueSystem.receiveMessages('source-queue');
    expect(sourceMessages.length).toBe(0);
    
    // Dead letter queue should have the message
    const dlqMessages = await queueSystem.receiveMessages('dlq-queue');
    expect(dlqMessages.length).toBe(1);
    expect(dlqMessages[0].body).toBe('Failed message');
    expect(dlqMessages[0].attributes.deadLetterReason).toBe('Test failure');
  });

  test('should purge a queue', async () => {
    // Create a queue
    await queueSystem.createQueue('test-queue');
    
    // Send some messages
    await queueSystem.sendMessage('test-queue', 'Message 1');
    await queueSystem.sendMessage('test-queue', 'Message 2');
    await queueSystem.sendMessage('test-queue', 'Message 3');
    
    // Verify messages are there
    const attributes = await queueSystem.getQueueAttributes('test-queue');
    expect(attributes.stats.messageCount).toBe(3);
    
    // Purge the queue
    const purgedCount = await queueSystem.purgeQueue('test-queue');
    expect(purgedCount).toBe(3);
    
    // Verify queue is empty
    const emptyAttributes = await queueSystem.getQueueAttributes('test-queue');
    expect(emptyAttributes.stats.messageCount).toBe(0);
  });

  test('should get system stats', async () => {
    // Create some queues
    await queueSystem.createQueue('queue1');
    await queueSystem.createQueue('queue2');
    
    // Send some messages
    await queueSystem.sendMessage('queue1', 'Message 1');
    await queueSystem.sendMessage('queue1', 'Message 2');
    await queueSystem.sendMessage('queue2', 'Message 3');
    
    // Get system stats
    const stats = await queueSystem.getSystemStats();
    
    expect(stats.queueCount).toBe(2);
    expect(stats.totalMessageCount).toBe(3);
    expect(stats.queueStats.queue1.messageCount).toBe(2);
    expect(stats.queueStats.queue2.messageCount).toBe(1);
  });

  test('should delete a queue', async () => {
    // Create a queue
    await queueSystem.createQueue('test-queue');
    
    // Verify it exists
    let queues = await queueSystem.listQueues();
    expect(queues).toContain('test-queue');
    
    // Delete the queue
    const result = await queueSystem.deleteQueue('test-queue');
    expect(result).toBe(true);
    
    // Verify it's gone
    queues = await queueSystem.listQueues();
    expect(queues).not.toContain('test-queue');
  });
});

// Test FIFO queue specific functionality
describe('FifoQueue', () => {
  let queueSystem;

  beforeEach(() => {
    queueSystem = new MessageQueueSystem({
      storageType: 'memory',
      autoStart: false
    });
  });

  afterEach(async () => {
    if (queueSystem) {
      queueSystem.cleanup();
    }
  });

  test('should maintain FIFO order', async () => {
    // Create a FIFO queue
    await queueSystem.createQueue('fifo-queue', { type: 'fifo' });
    
    // Send messages in order
    await queueSystem.sendMessage('fifo-queue', 'First');
    await queueSystem.sendMessage('fifo-queue', 'Second');
    await queueSystem.sendMessage('fifo-queue', 'Third');
    
    // Receive messages one by one
    const firstBatch = await queueSystem.receiveMessages('fifo-queue', { maxMessages: 1 });
    expect(firstBatch[0].body).toBe('First');
    
    const secondBatch = await queueSystem.receiveMessages('fifo-queue', { maxMessages: 1 });
    expect(secondBatch[0].body).toBe('Second');
    
    const thirdBatch = await queueSystem.receiveMessages('fifo-queue', { maxMessages: 1 });
    expect(thirdBatch[0].body).toBe('Third');
  });

  test('should support message groups', async () => {
    // Create a FIFO queue
    await queueSystem.createQueue('fifo-queue', { type: 'fifo' });
    
    // Send messages to different groups
    await queueSystem.sendMessage('fifo-queue', 'Group A - 1', { messageGroupId: 'A' });
    await queueSystem.sendMessage('fifo-queue', 'Group B - 1', { messageGroupId: 'B' });
    await queueSystem.sendMessage('fifo-queue', 'Group A - 2', { messageGroupId: 'A' });
    
    // Receive messages from group A
    const groupAMessages = await queueSystem.receiveMessages('fifo-queue', { 
      messageGroupId: 'A',
      maxMessages: 10
    });
    
    expect(groupAMessages.length).toBe(2);
    expect(groupAMessages[0].body).toBe('Group A - 1');
    expect(groupAMessages[1].body).toBe('Group A - 2');
    
    // Receive messages from group B
    const groupBMessages = await queueSystem.receiveMessages('fifo-queue', { 
      messageGroupId: 'B',
      maxMessages: 10
    });
    
    expect(groupBMessages.length).toBe(1);
    expect(groupBMessages[0].body).toBe('Group B - 1');
  });
});

// Test PriorityQueue specific functionality
describe('PriorityQueue', () => {
  let queueSystem;

  beforeEach(() => {
    queueSystem = new MessageQueueSystem({
      storageType: 'memory',
      autoStart: false
    });
  });

  afterEach(async () => {
    if (queueSystem) {
      queueSystem.cleanup();
    }
  });

  test('should process messages by priority', async () => {
    // Create a priority queue
    await queueSystem.createQueue('priority-queue', { 
      type: 'priority',
      priorityLevels: [1, 5, 10]
    });
    
    // Send messages with different priorities
    await queueSystem.sendMessage('priority-queue', 'Low Priority', { priority: 1 });
    await queueSystem.sendMessage('priority-queue', 'Medium Priority', { priority: 5 });
    await queueSystem.sendMessage('priority-queue', 'High Priority', { priority: 10 });
    
    // Receive messages (should come in priority order)
    const messages = await queueSystem.receiveMessages('priority-queue', { maxMessages: 3 });
    
    expect(messages.length).toBe(3);
    expect(messages[0].body).toBe('High Priority');
    expect(messages[1].body).toBe('Medium Priority');
    expect(messages[2].body).toBe('Low Priority');
  });

  test('should filter by priority range', async () => {
    // Create a priority queue
    await queueSystem.createQueue('priority-queue', { 
      type: 'priority',
      priorityLevels: [1, 2, 3, 4, 5]
    });
    
    // Send messages with different priorities
    await queueSystem.sendMessage('priority-queue', 'Priority 1', { priority: 1 });
    await queueSystem.sendMessage('priority-queue', 'Priority 2', { priority: 2 });
    await queueSystem.sendMessage('priority-queue', 'Priority 3', { priority: 3 });
    await queueSystem.sendMessage('priority-queue', 'Priority 4', { priority: 4 });
    await queueSystem.sendMessage('priority-queue', 'Priority 5', { priority: 5 });
    
    // Receive messages with priority 3-5
    const highPriorityMessages = await queueSystem.receiveMessages('priority-queue', { 
      minPriority: 3,
      maxMessages: 10
    });
    
    expect(highPriorityMessages.length).toBe(3);
    expect(highPriorityMessages[0].body).toBe('Priority 5');
    expect(highPriorityMessages[1].body).toBe('Priority 4');
    expect(highPriorityMessages[2].body).toBe('Priority 3');
    
    // Receive messages with priority 1-2
    const lowPriorityMessages = await queueSystem.receiveMessages('priority-queue', { 
      maxPriority: 2,
      maxMessages: 10
    });
    
    expect(lowPriorityMessages.length).toBe(2);
    expect(lowPriorityMessages[0].body).toBe('Priority 2');
    expect(lowPriorityMessages[1].body).toBe('Priority 1');
  });
});

// Test DelayedQueue specific functionality
describe('DelayedQueue', () => {
  let queueSystem;

  beforeEach(() => {
    queueSystem = new MessageQueueSystem({
      storageType: 'memory',
      autoStart: false
    });
  });

  afterEach(async () => {
    if (queueSystem) {
      queueSystem.cleanup();
    }
  });

  test('should delay message visibility', async () => {
    // Create a delayed queue
    await queueSystem.createQueue('delayed-queue', { type: 'delayed' });
    
    // Send a message with a delay
    await queueSystem.sendMessage('delayed-queue', 'Delayed Message', { delaySeconds: 2 });
    
    // Try to receive immediately (should be empty)
    const emptyMessages = await queueSystem.receiveMessages('delayed-queue');
    expect(emptyMessages.length).toBe(0);
    
    // Wait for the delay to pass
    await new Promise(resolve => setTimeout(resolve, 2100));
    
    // Now we should be able to receive the message
    const messages = await queueSystem.receiveMessages('delayed-queue');
    expect(messages.length).toBe(1);
    expect(messages[0].body).toBe('Delayed Message');
  });

  test('should change message delay', async () => {
    // Create a delayed queue
    await queueSystem.createQueue('delayed-queue', { type: 'delayed' });
    
    // Send a message with a long delay
    const messageId = await queueSystem.sendMessage('delayed-queue', 'Delayed Message', { 
      delaySeconds: 60 // 1 minute
    });
    
    // Change the delay to a shorter time
    await queueSystem.changeMessageDelay('delayed-queue', messageId, 1);
    
    // Try to receive immediately (should be empty)
    const emptyMessages = await queueSystem.receiveMessages('delayed-queue');
    expect(emptyMessages.length).toBe(0);
    
    // Wait for the new delay to pass
    await new Promise(resolve => setTimeout(resolve, 1100));
    
    // Now we should be able to receive the message
    const messages = await queueSystem.receiveMessages('delayed-queue');
    expect(messages.length).toBe(1);
    expect(messages[0].body).toBe('Delayed Message');
  });
});
