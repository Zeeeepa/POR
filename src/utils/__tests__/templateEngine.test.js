/**
 * Template Engine Tests
 * Tests for the enhanced template engine functionality
 */
const path = require('path');
const fs = require('fs').promises;

// Mock the logger and config modules
jest.mock('../logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  stream: { write: jest.fn() },
  logError: jest.fn()
}));

jest.mock('../config', () => ({
  logging: {
    level: 'info',
    directory: './logs',
    maxSize: 10485760,
    maxFiles: 5,
    serviceName: 'test-service'
  },
  get: (key, defaultValue) => defaultValue
}));

const TemplateEngine = require('../templateEngine');

// Create a temporary test directory for templates
const TEST_TEMPLATES_DIR = path.join(__dirname, 'test-templates');

// Setup and teardown
beforeAll(async () => {
  try {
    await fs.mkdir(TEST_TEMPLATES_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creating test templates directory:', error);
  }
});

afterAll(async () => {
  try {
    // Clean up test templates directory
    await fs.rm(TEST_TEMPLATES_DIR, { recursive: true, force: true });
  } catch (error) {
    console.error('Error cleaning up test templates directory:', error);
  }
});

describe('TemplateEngine', () => {
  let engine;

  beforeEach(() => {
    // Create a fresh engine instance for each test
    engine = new TemplateEngine({
      templatesDir: TEST_TEMPLATES_DIR,
      enableCaching: true
    });
  });

  describe('Basic Functionality', () => {
    test('should initialize with default options', () => {
      const defaultEngine = new TemplateEngine();
      expect(defaultEngine.templatesDir).toContain('data/templates');
      expect(defaultEngine.enableCaching).toBe(true);
    });

    test('should initialize with custom options', () => {
      const customEngine = new TemplateEngine({
        templatesDir: '/custom/path',
        enableCaching: false,
        cacheTTL: 60000
      });
      expect(customEngine.templatesDir).toBe('/custom/path');
      expect(customEngine.enableCaching).toBe(false);
      expect(customEngine.cacheTTL).toBe(60000);
    });
  });

  describe('Simple Template Engine', () => {
    test('should render a simple template with variables', async () => {
      const template = 'Hello, {{name}}!';
      const context = { name: 'World' };
      const result = await engine.render(template, context);
      expect(result).toBe('Hello, World!');
    });

    test('should handle nested variables', async () => {
      const template = 'Hello, {{user.name}}!';
      const context = { user: { name: 'John' } };
      const result = await engine.render(template, context);
      expect(result).toBe('Hello, John!');
    });

    test('should handle conditionals', async () => {
      const template = '{{#if isActive}}Active{{else}}Inactive{{/if}}';
      
      const activeContext = { isActive: true };
      const activeResult = await engine.render(template, activeContext);
      expect(activeResult).toBe('Active');
      
      const inactiveContext = { isActive: false };
      const inactiveResult = await engine.render(template, inactiveContext);
      expect(inactiveResult).toBe('Inactive');
    });

    test('should handle loops', async () => {
      const template = 'Items: {{#each items}}{{this}}{{#if @index < 2}}, {{/if}}{{/each}}';
      const context = { items: ['apple', 'banana', 'orange'] };
      const result = await engine.render(template, context);
      expect(result).toBe('Items: apple, banana, orange');
    });

    test('should handle helpers', async () => {
      const template = 'Hello, {{uppercase name}}!';
      const context = { name: 'world' };
      const result = await engine.render(template, context);
      expect(result).toBe('Hello, WORLD!');
    });
  });

  describe('Handlebars Engine', () => {
    test('should render a handlebars template', async () => {
      const template = 'Hello, {{name}}!';
      const context = { name: 'World' };
      const result = await engine.render(template, context, { engine: 'handlebars' });
      expect(result).toBe('Hello, World!');
    });

    test('should handle handlebars conditionals', async () => {
      const template = '{{#if isActive}}Active{{else}}Inactive{{/if}}';
      const context = { isActive: true };
      const result = await engine.render(template, context, { engine: 'handlebars' });
      expect(result).toBe('Active');
    });

    test('should handle handlebars loops', async () => {
      const template = 'Items: {{#each items}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}';
      const context = { items: ['apple', 'banana', 'orange'] };
      const result = await engine.render(template, context, { engine: 'handlebars' });
      expect(result).toBe('Items: apple, banana, orange');
    });
  });

  describe('EJS Engine', () => {
    test('should render an EJS template', async () => {
      const template = 'Hello, <%= name %>!';
      const context = { name: 'World' };
      const result = await engine.render(template, context, { engine: 'ejs' });
      expect(result).toBe('Hello, World!');
    });

    test('should handle EJS conditionals', async () => {
      const template = '<% if (isActive) { %>Active<% } else { %>Inactive<% } %>';
      const context = { isActive: true };
      const result = await engine.render(template, context, { engine: 'ejs' });
      expect(result).toBe('Active');
    });

    test('should handle EJS loops', async () => {
      const template = 'Items: <% items.forEach((item, index) => { %><%= item %><% if (index < items.length - 1) { %>, <% } %><% }); %>';
      const context = { items: ['apple', 'banana', 'orange'] };
      const result = await engine.render(template, context, { engine: 'ejs' });
      expect(result).toBe('Items: apple, banana, orange');
    });
  });

  describe('Template Files', () => {
    beforeEach(async () => {
      // Create test template files
      await fs.writeFile(path.join(TEST_TEMPLATES_DIR, 'simple.txt'), 'Hello, {{name}}!');
      await fs.writeFile(path.join(TEST_TEMPLATES_DIR, 'template.hbs'), 'Hello, {{name}} from Handlebars!');
      await fs.writeFile(path.join(TEST_TEMPLATES_DIR, 'template.ejs'), 'Hello, <%= name %> from EJS!');
    });

    test('should render a simple template file', async () => {
      const result = await engine.renderFile('simple.txt', { name: 'World' });
      expect(result).toBe('Hello, World!');
    });

    test('should auto-detect handlebars engine from file extension', async () => {
      const result = await engine.renderFile('template.hbs', { name: 'World' });
      expect(result).toBe('Hello, World from Handlebars!');
    });

    test('should auto-detect EJS engine from file extension', async () => {
      const result = await engine.renderFile('template.ejs', { name: 'World' });
      expect(result).toBe('Hello, World from EJS!');
    });
  });

  describe('Partials', () => {
    test('should render partials in templates', async () => {
      engine.registerPartial('header', '<h1>{{title}}</h1>');
      engine.registerPartial('footer', '<footer>{{copyright}}</footer>');
      
      const template = '{{> header}}<div>{{content}}</div>{{> footer}}';
      const context = {
        title: 'My Page',
        content: 'Page content',
        copyright: '© 2023'
      };
      
      const result = await engine.render(template, context);
      expect(result).toBe('<h1>My Page</h1><div>Page content</div><footer>© 2023</footer>');
    });
  });

  describe('Helpers', () => {
    test('should register and use custom helpers', async () => {
      engine.registerHelper('repeat', (text, times) => {
        return new Array(times + 1).join(text);
      });
      
      const template = '{{repeat "x" 3}}';
      const result = await engine.render(template, {});
      expect(result).toBe('xxx');
    });

    test('should use built-in helpers', async () => {
      const template = '{{uppercase name}} {{lowercase name}} {{capitalize name}}';
      const context = { name: 'john' };
      const result = await engine.render(template, context);
      expect(result).toBe('JOHN john John');
    });
  });

  describe('Caching', () => {
    test('should cache rendered templates', async () => {
      const template = 'Hello, {{name}}!';
      const context = { name: 'World' };
      
      // First render should cache the result
      await engine.render(template, context);
      
      // Mock the compile method to track if it's called
      const mockCompile = jest.fn().mockReturnValue(() => 'Hello, World!');
      const originalCompile = engine.engines.get('simple').compile;
      engine.engines.get('simple').compile = mockCompile;
      
      // Second render should use cache
      await engine.render(template, context);
      
      // Verify compile wasn't called for the second render
      expect(mockCompile).not.toHaveBeenCalled();
      
      // Restore original compile method
      engine.engines.get('simple').compile = originalCompile;
    });

    test('should clear cache when requested', async () => {
      const template = 'Hello, {{name}}!';
      const context = { name: 'World' };
      
      // First render should cache the result
      await engine.render(template, context);
      
      // Clear the cache
      engine.clearCache();
      
      // Mock the compile method to track if it's called
      const mockCompile = jest.fn().mockImplementation((tpl) => {
        return () => 'Hello, World!';
      });
      const originalCompile = engine.engines.get('simple').compile;
      engine.engines.get('simple').compile = mockCompile;
      
      // Second render should not use cache
      await engine.render(template, context);
      
      // Verify compile was called after cache was cleared
      expect(mockCompile).toHaveBeenCalled();
      
      // Restore original compile method
      engine.engines.get('simple').compile = originalCompile;
    });
  });

  describe('Template Validation', () => {
    test('should validate a correct template', () => {
      const template = 'Hello, {{name}}!';
      const result = engine.validateTemplate(template);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    test('should detect unclosed tags', () => {
      const template = '{{#if condition}}Hello{{/each}}';
      const result = engine.validateTemplate(template);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(1);
    });
  });

  describe('Custom Engines', () => {
    test('should register and use a custom engine', async () => {
      // Register a simple custom engine
      engine.registerEngine('custom', {
        compile: (template) => {
          return (context) => template.replace(/\$\{([^}]+)\}/g, (_, key) => context[key] || '');
        },
        renderFile: async (filePath, context) => {
          const template = await fs.readFile(filePath, 'utf8');
          return template.replace(/\$\{([^}]+)\}/g, (_, key) => context[key] || '');
        }
      });
      
      const template = 'Hello, ${name}!';
      const context = { name: 'World' };
      const result = await engine.render(template, context, { engine: 'custom' });
      expect(result).toBe('Hello, World!');
    });
  });

  describe('Precompilation', () => {
    test('should precompile and render a template', async () => {
      const template = 'Hello, {{name}}!';
      const context = { name: 'World' };
      
      // Precompile the template
      const compiled = engine.precompile(template);
      
      // Render using the precompiled template
      const result = await compiled(context);
      expect(result).toBe('Hello, World!');
    });
  });
});
