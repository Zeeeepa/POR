/**
 * Basic usage example for MessageQueueSystem
 */

const MessageQueueSystem = require('../src/models/MessageQueueSystem');

async function main() {
  // Create a new message queue system
  const queueSystem = new MessageQueueSystem({
    storageType: 'memory',
    autoStart: true
  });

  try {
    console.log('Creating queues...');
    
    // Create different types of queues
    await queueSystem.createQueue('fifo-queue', { type: 'fifo' });
    await queueSystem.createQueue('priority-queue', { 
      type: 'priority',
      priorityLevels: [1, 5, 10],
      defaultPriority: 5
    });
    await queueSystem.createQueue('delayed-queue', { type: 'delayed' });
    await queueSystem.createQueue('dlq-queue', { type: 'fifo' });
    
    // Set up dead letter queue
    await queueSystem.setDeadLetterQueue('fifo-queue', 'dlq-queue');
    
    console.log('Sending messages...');
    
    // Send messages to FIFO queue
    await queueSystem.sendMessage('fifo-queue', 'FIFO Message 1');
    await queueSystem.sendMessage('fifo-queue', 'FIFO Message 2');
    
    // Send messages to priority queue
    await queueSystem.sendMessage('priority-queue', 'Low Priority', { priority: 1 });
    await queueSystem.sendMessage('priority-queue', 'Medium Priority', { priority: 5 });
    await queueSystem.sendMessage('priority-queue', 'High Priority', { priority: 10 });
    
    // Send message to delayed queue
    const delayedMessageId = await queueSystem.sendMessage('delayed-queue', 'Delayed Message', {
      delaySeconds: 5
    });
    
    console.log('Receiving messages from FIFO queue...');
    const fifoMessages = await queueSystem.receiveMessages('fifo-queue', { maxMessages: 10 });
    console.log(`Received ${fifoMessages.length} messages from FIFO queue:`);
    for (const message of fifoMessages) {
      console.log(`- ${message.body}`);
      await queueSystem.acknowledgeMessage('fifo-queue', message.id);
    }
    
    console.log('\nReceiving messages from priority queue...');
    const priorityMessages = await queueSystem.receiveMessages('priority-queue', { maxMessages: 10 });
    console.log(`Received ${priorityMessages.length} messages from priority queue (highest priority first):`);
    for (const message of priorityMessages) {
      console.log(`- ${message.body} (Priority: ${message.attributes.priority})`);
      await queueSystem.acknowledgeMessage('priority-queue', message.id);
    }
    
    console.log('\nWaiting for delayed message to become visible...');
    await new Promise(resolve => setTimeout(resolve, 5500));
    
    console.log('Receiving messages from delayed queue...');
    const delayedMessages = await queueSystem.receiveMessages('delayed-queue', { maxMessages: 10 });
    console.log(`Received ${delayedMessages.length} messages from delayed queue:`);
    for (const message of delayedMessages) {
      console.log(`- ${message.body}`);
      await queueSystem.acknowledgeMessage('delayed-queue', message.id);
    }
    
    // Send a message to the dead letter queue
    console.log('\nSending a message to be dead-lettered...');
    const messageId = await queueSystem.sendMessage('fifo-queue', 'Failed Message');
    await queueSystem.deadLetterMessage('fifo-queue', messageId, 'Test failure');
    
    console.log('Receiving messages from dead letter queue...');
    const dlqMessages = await queueSystem.receiveMessages('dlq-queue', { maxMessages: 10 });
    console.log(`Received ${dlqMessages.length} messages from dead letter queue:`);
    for (const message of dlqMessages) {
      console.log(`- ${message.body} (Reason: ${message.attributes.deadLetterReason})`);
      await queueSystem.acknowledgeMessage('dlq-queue', message.id);
    }
    
    // Get system stats
    console.log('\nSystem stats:');
    const stats = await queueSystem.getSystemStats();
    console.log(JSON.stringify(stats, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Clean up
    queueSystem.cleanup();
  }
}

main().catch(console.error);
