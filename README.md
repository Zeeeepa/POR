# Message Queue System

A robust message queue system with support for multiple queue types, persistence, acknowledgment, monitoring, and more.

## Features

- **Multiple Queue Types**:
  - FIFO (First-In-First-Out) queues
  - Priority queues
  - Delayed queues

- **Message Persistence**:
  - In-memory storage
  - File-based storage
  - Extensible storage adapter system

- **Message Acknowledgment and Retry**:
  - Visibility timeout for message processing
  - Automatic retry for failed messages
  - Dead letter queues for unprocessable messages

- **Queue Monitoring and Statistics**:
  - Detailed queue statistics
  - System-wide monitoring
  - Event-based monitoring

- **Rate Limiting and Throttling**:
  - Per-queue rate limiting
  - Configurable throttling

- **Distributed Queue Processing**:
  - Support for message groups in FIFO queues
  - Scalable architecture

- **Error Handling**:
  - Specific error types
  - Comprehensive error reporting
  - Dead letter queues

## Installation

```bash
npm install
```

## Usage

### Basic Usage

```javascript
const MessageQueueSystem = require('./src/models/MessageQueueSystem');

// Create a new message queue system
const queueSystem = new MessageQueueSystem({
  storageType: 'memory', // or 'file'
  storageOptions: {
    // Storage-specific options
  }
});

// Create a queue
await queueSystem.createQueue('my-queue', {
  type: 'fifo', // or 'priority', 'delayed'
  // Queue-specific options
});

// Send a message
const messageId = await queueSystem.sendMessage('my-queue', 'Hello, world!');

// Receive messages
const messages = await queueSystem.receiveMessages('my-queue', {
  maxMessages: 10
});

// Process messages
for (const message of messages) {
  console.log(`Processing message: ${message.body}`);
  
  // Acknowledge the message when done
  await queueSystem.acknowledgeMessage('my-queue', message.id);
}

// Clean up when done
queueSystem.cleanup();
```

### FIFO Queues

FIFO queues guarantee that messages are processed in the exact order they were sent.

```javascript
// Create a FIFO queue
await queueSystem.createQueue('fifo-queue', { type: 'fifo' });

// Send messages to different message groups
await queueSystem.sendMessage('fifo-queue', 'Message 1', { messageGroupId: 'group1' });
await queueSystem.sendMessage('fifo-queue', 'Message 2', { messageGroupId: 'group1' });
await queueSystem.sendMessage('fifo-queue', 'Message 3', { messageGroupId: 'group2' });

// Receive messages from a specific group
const messages = await queueSystem.receiveMessages('fifo-queue', {
  messageGroupId: 'group1',
  maxMessages: 10
});
```

### Priority Queues

Priority queues process messages based on their priority level.

```javascript
// Create a priority queue
await queueSystem.createQueue('priority-queue', {
  type: 'priority',
  priorityLevels: [1, 2, 3, 4, 5],
  defaultPriority: 3
});

// Send messages with different priorities
await queueSystem.sendMessage('priority-queue', 'High Priority', { priority: 5 });
await queueSystem.sendMessage('priority-queue', 'Medium Priority', { priority: 3 });
await queueSystem.sendMessage('priority-queue', 'Low Priority', { priority: 1 });

// Receive messages (highest priority first)
const messages = await queueSystem.receiveMessages('priority-queue');
```

### Delayed Queues

Delayed queues make messages available for processing after a specified delay.

```javascript
// Create a delayed queue
await queueSystem.createQueue('delayed-queue', { type: 'delayed' });

// Send a message with a delay
await queueSystem.sendMessage('delayed-queue', 'Delayed Message', {
  delaySeconds: 60 // 1 minute
});

// Change the delay of a message
await queueSystem.changeMessageDelay('delayed-queue', messageId, 30);
```

### Dead Letter Queues

Dead letter queues store messages that couldn't be processed successfully.

```javascript
// Create source and dead letter queues
await queueSystem.createQueue('source-queue');
await queueSystem.createQueue('dlq-queue');

// Set up dead letter queue
await queueSystem.setDeadLetterQueue('source-queue', 'dlq-queue');

// Move a message to the dead letter queue
await queueSystem.deadLetterMessage('source-queue', messageId, 'Processing failed');
```

## API Reference

### MessageQueueSystem

- `constructor(options)`: Initialize the message queue system
- `createQueue(name, options)`: Create a new queue
- `deleteQueue(name)`: Delete a queue
- `sendMessage(queueName, message, options)`: Send a message to a queue
- `receiveMessages(queueName, options)`: Receive messages from a queue
- `acknowledgeMessage(queueName, messageId)`: Acknowledge a message as processed
- `deadLetterMessage(queueName, messageId, reason)`: Move a message to the dead letter queue
- `purgeQueue(queueName)`: Remove all messages from a queue
- `getQueueAttributes(queueName)`: Get queue attributes and statistics
- `setQueueAttributes(queueName, attributes)`: Set queue attributes
- `listQueues(prefix)`: List all queues with an optional prefix
- `setDeadLetterQueue(sourceQueueName, deadLetterQueueName)`: Set up a dead letter queue
- `changeMessageDelay(queueName, messageId, delaySeconds)`: Change the delay of a message
- `getSystemStats()`: Get system statistics
- `cleanup()`: Clean up resources

## Testing

Run the test suite:

```bash
npm test
```

## License

MIT
