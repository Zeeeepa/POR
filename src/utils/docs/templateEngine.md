# Template Engine Documentation

The Template Engine is a comprehensive, flexible, and extensible system for rendering templates with various formats and features. It supports multiple template engines, variable substitution, conditional rendering, loops, template inheritance, caching, validation, and asynchronous rendering.

## Table of Contents

1. [Installation](#installation)
2. [Basic Usage](#basic-usage)
3. [Template Formats](#template-formats)
4. [Features](#features)
   - [Variable Substitution](#variable-substitution)
   - [Conditional Rendering](#conditional-rendering)
   - [Loops](#loops)
   - [Helpers](#helpers)
   - [Partials](#partials)
   - [Template Inheritance](#template-inheritance)
   - [Caching](#caching)
   - [Validation](#validation)
   - [Precompilation](#precompilation)
5. [API Reference](#api-reference)
6. [Custom Engines](#custom-engines)
7. [Examples](#examples)

## Installation

The Template Engine requires the following dependencies:

```bash
npm install handlebars ejs lodash memory-cache
```

## Basic Usage

```javascript
const TemplateEngine = require('./utils/templateEngine');

// Initialize the template engine
const engine = new TemplateEngine({
  templatesDir: './templates',
  enableCaching: true,
  cacheTTL: 3600000 // 1 hour
});

// Render a simple template
async function renderTemplate() {
  const template = 'Hello, {{name}}!';
  const context = { name: 'World' };
  
  const result = await engine.render(template, context);
  console.log(result); // Output: Hello, World!
}

// Render a template file
async function renderTemplateFile() {
  const result = await engine.renderFile('welcome.hbs', {
    name: 'John',
    isAdmin: true,
    roles: ['Editor', 'Admin']
  });
  console.log(result);
}
```

## Template Formats

The Template Engine supports multiple template formats:

### Simple Template Format

The built-in simple template format uses Handlebars-like syntax:

```
Hello, {{name}}!

{{#if isAdmin}}
  You have admin privileges.
{{else}}
  You have regular user privileges.
{{/if}}

Your roles:
{{#each roles}}
* {{this}}
{{/each}}
```

### Handlebars

Handlebars templates use the standard Handlebars syntax:

```
Hello, {{name}}!

{{#if isAdmin}}
  You have admin privileges.
{{else}}
  You have regular user privileges.
{{/if}}

Your roles:
{{#each roles}}
* {{this}}
{{/each}}
```

### EJS

EJS templates use the standard EJS syntax:

```
Hello, <%= name %>!

<% if (isAdmin) { %>
  You have admin privileges.
<% } else { %>
  You have regular user privileges.
<% } %>

Your roles:
<% roles.forEach(function(role) { %>
* <%= role %>
<% }); %>
```

## Features

### Variable Substitution

Variables can be inserted into templates using the appropriate syntax for each engine:

- Simple/Handlebars: `{{variableName}}`
- EJS: `<%= variableName %>`

Nested variables are supported using dot notation:

- Simple/Handlebars: `{{user.name}}`
- EJS: `<%= user.name %>`

### Conditional Rendering

Conditionals allow for dynamic content based on context values:

#### Simple/Handlebars:

```
{{#if condition}}
  Content when condition is true
{{else}}
  Content when condition is false
{{/if}}
```

#### EJS:

```
<% if (condition) { %>
  Content when condition is true
<% } else { %>
  Content when condition is false
<% } %>
```

### Loops

Loops allow for iterating over arrays or collections:

#### Simple/Handlebars:

```
{{#each items}}
  {{this}} or {{this.property}}
{{/each}}
```

#### EJS:

```
<% items.forEach(function(item) { %>
  <%= item %> or <%= item.property %>
<% }); %>
```

### Helpers

Helpers are functions that can be used in templates to transform or format data:

```javascript
// Register a helper
engine.registerHelper('formatCurrency', (amount, currency = '$') => {
  return `${currency}${parseFloat(amount).toFixed(2)}`;
});

// Use the helper in a template
// Simple/Handlebars: {{formatCurrency price "€"}}
// EJS: <%= helpers.formatCurrency(price, "€") %>
```

#### Built-in Helpers

The Template Engine comes with several built-in helpers:

- String helpers: `uppercase`, `lowercase`, `capitalize`, `trim`
- Array helpers: `join`, `first`, `last`, `length`
- Date helpers: `date`, `formatDate`
- Conditional helpers: `if`, `eq`, `neq`, `gt`, `gte`, `lt`, `lte`
- Math helpers: `add`, `subtract`, `multiply`, `divide`
- Object helpers: `json`, `get`

### Partials

Partials are reusable template fragments that can be included in other templates:

```javascript
// Register a partial
engine.registerPartial('header', '<header>{{title}}</header>');

// Use the partial in a template
// Simple/Handlebars: {{> header}}
// EJS: <%- include('header', { title: title }) %>
```

### Template Inheritance

Template inheritance allows templates to extend or include other templates:

#### Handlebars:

Handlebars supports template inheritance through partials and the built-in block helpers.

#### EJS:

EJS supports template inheritance through the `include` function.

### Caching

The Template Engine includes built-in caching to improve performance:

```javascript
const engine = new TemplateEngine({
  enableCaching: true,
  cacheTTL: 3600000 // 1 hour
});

// Clear the cache when needed
engine.clearCache();
```

### Validation

Templates can be validated before rendering to catch syntax errors:

```javascript
const validationResult = engine.validateTemplate(template);

if (validationResult.valid) {
  console.log('Template is valid');
} else {
  console.log('Template has errors:', validationResult.errors);
}
```

### Precompilation

Templates can be precompiled for faster rendering:

```javascript
// Precompile a template
const compiledTemplate = engine.precompile(template);

// Render the precompiled template multiple times with different contexts
const result1 = await compiledTemplate({ name: 'John' });
const result2 = await compiledTemplate({ name: 'Jane' });
```

## API Reference

### Constructor

```javascript
const engine = new TemplateEngine(options);
```

Options:
- `templatesDir` (string): Directory to store templates (default: `path.join(process.cwd(), 'data', 'templates')`)
- `enableCaching` (boolean): Whether to enable template caching (default: `true`)
- `cacheTTL` (number): Cache time-to-live in milliseconds (default: `3600000` - 1 hour)
- `engines` (object): Custom engine configurations

### Methods

#### `render(template, context, options)`

Renders a template string with the provided context.

- `template` (string): Template string to render
- `context` (object): Context object with variables
- `options` (object): Render options
  - `engine` (string): Template engine to use (default: 'simple')
  - `cache` (boolean): Whether to use cache (overrides global setting)

Returns: Promise<string> - Rendered template

#### `renderFile(filePath, context, options)`

Renders a template file with the provided context.

- `filePath` (string): Path to template file (relative to templatesDir or absolute)
- `context` (object): Context object with variables
- `options` (object): Render options
  - `engine` (string): Template engine to use (auto-detected from file extension if not specified)
  - `cache` (boolean): Whether to use cache (overrides global setting)

Returns: Promise<string> - Rendered template

#### `registerHelper(name, fn)`

Registers a helper function.

- `name` (string): Helper name
- `fn` (function): Helper function

#### `registerPartial(name, content)`

Registers a partial template.

- `name` (string): Partial name
- `content` (string): Partial content

#### `registerEngine(type, engine)`

Registers a custom template engine.

- `type` (string): Engine type
- `engine` (object): Engine implementation with `compile` and `renderFile` methods

#### `getEngine(type)`

Gets a specific template engine instance.

- `type` (string): Engine type

Returns: Object - Engine instance

#### `precompile(template, options)`

Precompiles a template for faster rendering.

- `template` (string): Template string
- `options` (object): Compile options
  - `engine` (string): Template engine to use (default: 'simple')

Returns: Function - Compiled template function

#### `validateTemplate(template, options)`

Validates a template for syntax errors.

- `template` (string): Template string
- `options` (object): Validation options
  - `engine` (string): Template engine to use (default: 'simple')

Returns: Object - Validation result with `valid` boolean and `errors` array

#### `clearCache()`

Clears the template cache.

## Custom Engines

You can register custom template engines to support additional formats:

```javascript
engine.registerEngine('custom', {
  compile: (template, options) => {
    // Compile the template
    return (context) => {
      // Return the rendered template
      return renderedTemplate;
    };
  },
  renderFile: async (filePath, context, options) => {
    // Read and render the template file
    return renderedTemplate;
  },
  // Optional methods
  registerHelper: (name, fn) => {
    // Register a helper
  },
  registerPartial: (name, content) => {
    // Register a partial
  }
});
```

## Examples

See the `src/examples/templateEngineExample.js` file for comprehensive examples of using the Template Engine.

```javascript
// Example: Simple template with variable substitution
const template = 'Hello, {{name}}!';
const context = { name: 'World' };
const result = await engine.render(template, context);
// Result: Hello, World!

// Example: Conditional rendering
const template = '{{#if isActive}}Active{{else}}Inactive{{/if}}';
const context = { isActive: true };
const result = await engine.render(template, context);
// Result: Active

// Example: Loops
const template = 'Items: {{#each items}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}';
const context = { items: ['apple', 'banana', 'orange'] };
const result = await engine.render(template, context);
// Result: Items: apple, banana, orange

// Example: Helpers
engine.registerHelper('formatCurrency', (amount, currency = '$') => {
  return `${currency}${parseFloat(amount).toFixed(2)}`;
});
const template = 'Price: {{formatCurrency price "€"}}';
const context = { price: 99.95 };
const result = await engine.render(template, context);
// Result: Price: €99.95

// Example: Partials
engine.registerPartial('header', '<header>{{title}}</header>');
const template = '{{> header}}<main>{{content}}</main>';
const context = { title: 'My Page', content: 'Page content' };
const result = await engine.render(template, context);
// Result: <header>My Page</header><main>Page content</main>
```
