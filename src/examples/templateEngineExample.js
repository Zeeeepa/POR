/**
 * Template Engine Example
 * Demonstrates the usage of the enhanced template engine
 */
const path = require('path');
const fs = require('fs').promises;
const TemplateEngine = require('../utils/templateEngine');

async function runExamples() {
  console.log('Template Engine Examples');
  console.log('=======================\n');
  
  // Initialize the template engine
  const engine = new TemplateEngine({
    enableCaching: true,
    cacheTTL: 3600000 // 1 hour
  });
  
  // Create example templates directory
  const templatesDir = path.join(__dirname, 'templates');
  try {
    await fs.mkdir(templatesDir, { recursive: true });
  } catch (error) {
    console.error('Error creating templates directory:', error);
  }
  
  // Create example template files
  await fs.writeFile(
    path.join(templatesDir, 'welcome.hbs'),
    'Welcome, {{name}}!\n\n{{#if isAdmin}}You have admin privileges.{{else}}You have regular user privileges.{{/if}}\n\nYour roles:\n{{#each roles}}* {{this}}\n{{/each}}'
  );
  
  await fs.writeFile(
    path.join(templatesDir, 'email.ejs'),
    'Dear <%= user.name %>,\n\nThank you for your recent <%= order.type %> order (#<%= order.id %>).\n\n<% if (order.items.length > 0) { %>\nYour order contains the following items:\n<% order.items.forEach(function(item) { %>\n- <%= item.name %> ($<%= item.price.toFixed(2) %>)\n<% }); %>\n\nTotal: $<%= order.total.toFixed(2) %>\n<% } else { %>\nYour order is being processed.\n<% } %>\n\nRegards,\nThe Team'
  );
  
  // Example 1: Simple template with variable substitution
  console.log('Example 1: Simple Template');
  console.log('--------------------------');
  const simpleTemplate = 'Hello, {{name}}! Today is {{date "YYYY-MM-DD"}}.';
  const simpleContext = { name: 'John' };
  
  const simpleResult = await engine.render(simpleTemplate, simpleContext);
  console.log('Template:', simpleTemplate);
  console.log('Context:', JSON.stringify(simpleContext));
  console.log('Result:', simpleResult);
  console.log();
  
  // Example 2: Conditional rendering
  console.log('Example 2: Conditional Rendering');
  console.log('-------------------------------');
  const conditionalTemplate = '{{#if user.isActive}}User {{user.name}} is active.{{else}}User {{user.name}} is inactive.{{/if}}';
  const activeContext = { user: { name: 'Alice', isActive: true } };
  const inactiveContext = { user: { name: 'Bob', isActive: false } };
  
  const activeResult = await engine.render(conditionalTemplate, activeContext);
  const inactiveResult = await engine.render(conditionalTemplate, inactiveContext);
  
  console.log('Template:', conditionalTemplate);
  console.log('Active Context:', JSON.stringify(activeContext));
  console.log('Active Result:', activeResult);
  console.log('Inactive Context:', JSON.stringify(inactiveContext));
  console.log('Inactive Result:', inactiveResult);
  console.log();
  
  // Example 3: Loops
  console.log('Example 3: Loops');
  console.log('---------------');
  const loopTemplate = 'Shopping List:\n{{#each items}}* {{this.name}} ({{this.quantity}})\n{{/each}}';
  const loopContext = {
    items: [
      { name: 'Apples', quantity: '5' },
      { name: 'Bananas', quantity: '3' },
      { name: 'Milk', quantity: '1 gallon' }
    ]
  };
  
  const loopResult = await engine.render(loopTemplate, loopContext);
  console.log('Template:', loopTemplate);
  console.log('Context:', JSON.stringify(loopContext));
  console.log('Result:');
  console.log(loopResult);
  console.log();
  
  // Example 4: Helpers
  console.log('Example 4: Helpers');
  console.log('-----------------');
  
  // Register a custom helper
  engine.registerHelper('formatCurrency', (amount, currency = '$') => {
    return `${currency}${parseFloat(amount).toFixed(2)}`;
  });
  
  const helperTemplate = 'Product: {{name}}\nPrice: {{formatCurrency price}}\nDiscounted: {{formatCurrency (multiply price 0.9) "€"}}';
  const helperContext = { name: 'Headphones', price: 99.95 };
  
  const helperResult = await engine.render(helperTemplate, helperContext);
  console.log('Template:', helperTemplate);
  console.log('Context:', JSON.stringify(helperContext));
  console.log('Result:');
  console.log(helperResult);
  console.log();
  
  // Example 5: Partials
  console.log('Example 5: Partials');
  console.log('------------------');
  
  // Register partials
  engine.registerPartial('header', '<header>{{title}}</header>');
  engine.registerPartial('footer', '<footer>{{copyright}}</footer>');
  
  const partialTemplate = '{{> header}}\n<main>{{content}}</main>\n{{> footer}}';
  const partialContext = {
    title: 'My Website',
    content: 'Welcome to my website!',
    copyright: '© 2023 My Company'
  };
  
  const partialResult = await engine.render(partialTemplate, partialContext);
  console.log('Template:', partialTemplate);
  console.log('Context:', JSON.stringify(partialContext));
  console.log('Result:');
  console.log(partialResult);
  console.log();
  
  // Example 6: Handlebars template file
  console.log('Example 6: Handlebars Template File');
  console.log('----------------------------------');
  const hbsContext = {
    name: 'Sarah',
    isAdmin: true,
    roles: ['Editor', 'Moderator', 'Contributor']
  };
  
  const hbsResult = await engine.renderFile(
    path.join(templatesDir, 'welcome.hbs'),
    hbsContext
  );
  
  console.log('Context:', JSON.stringify(hbsContext));
  console.log('Result:');
  console.log(hbsResult);
  console.log();
  
  // Example 7: EJS template file
  console.log('Example 7: EJS Template File');
  console.log('---------------------------');
  const ejsContext = {
    user: { name: 'Michael' },
    order: {
      id: '12345',
      type: 'online',
      items: [
        { name: 'T-shirt', price: 19.99 },
        { name: 'Jeans', price: 49.95 },
        { name: 'Socks', price: 9.99 }
      ],
      total: 79.93
    }
  };
  
  const ejsResult = await engine.renderFile(
    path.join(templatesDir, 'email.ejs'),
    ejsContext
  );
  
  console.log('Context:', JSON.stringify(ejsContext));
  console.log('Result:');
  console.log(ejsResult);
  console.log();
  
  // Example 8: Template validation
  console.log('Example 8: Template Validation');
  console.log('-----------------------------');
  
  const validTemplate = '{{#if condition}}Valid template{{/if}}';
  const invalidTemplate = '{{#if condition}}Invalid template{{/each}}';
  
  const validResult = engine.validateTemplate(validTemplate);
  const invalidResult = engine.validateTemplate(invalidTemplate);
  
  console.log('Valid Template:', validTemplate);
  console.log('Validation Result:', JSON.stringify(validResult));
  console.log();
  
  console.log('Invalid Template:', invalidTemplate);
  console.log('Validation Result:', JSON.stringify(invalidResult));
  console.log();
  
  // Example 9: Template precompilation
  console.log('Example 9: Template Precompilation');
  console.log('--------------------------------');
  
  const templateToCompile = 'Hello, {{name}}! Your score is {{multiply score 10}}.';
  console.log('Template:', templateToCompile);
  
  // Precompile the template
  console.time('Precompile');
  const compiledTemplate = engine.precompile(templateToCompile);
  console.timeEnd('Precompile');
  
  // Render multiple times with different contexts
  const contexts = [
    { name: 'Player 1', score: 5 },
    { name: 'Player 2', score: 8 },
    { name: 'Player 3', score: 3 }
  ];
  
  console.time('Render with precompiled template');
  for (const ctx of contexts) {
    const result = await compiledTemplate(ctx);
    console.log(`Result for ${ctx.name}:`, result);
  }
  console.timeEnd('Render with precompiled template');
  console.log();
  
  // Example 10: Custom template engine
  console.log('Example 10: Custom Template Engine');
  console.log('--------------------------------');
  
  // Register a custom template engine
  engine.registerEngine('custom', {
    compile: (template) => {
      return (context) => template.replace(/\$\{([^}]+)\}/g, (_, key) => {
        return key.split('.').reduce((obj, prop) => obj && obj[prop], context) || '';
      });
    },
    renderFile: async (filePath, context) => {
      const template = await fs.readFile(filePath, 'utf8');
      return template.replace(/\$\{([^}]+)\}/g, (_, key) => {
        return key.split('.').reduce((obj, prop) => obj && obj[prop], context) || '';
      });
    }
  });
  
  const customTemplate = 'Hello, ${user.name}! Your email is ${user.email}.';
  const customContext = {
    user: {
      name: 'Jane',
      email: 'jane@example.com'
    }
  };
  
  const customResult = await engine.render(customTemplate, customContext, { engine: 'custom' });
  console.log('Template:', customTemplate);
  console.log('Context:', JSON.stringify(customContext));
  console.log('Result:', customResult);
  
  // Clean up example templates directory
  try {
    await fs.rm(templatesDir, { recursive: true, force: true });
  } catch (error) {
    console.error('Error cleaning up templates directory:', error);
  }
}

// Run the examples
runExamples().catch(error => {
  console.error('Error running examples:', error);
});
