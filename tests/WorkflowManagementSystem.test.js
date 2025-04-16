const WorkflowManagementSystem = require('../src/models/WorkflowManagementSystem');

describe('WorkflowManagementSystem', () => {
  let wms;

  beforeEach(() => {
    wms = new WorkflowManagementSystem();
  });

  test('creates and executes a simple workflow', async () => {
    const steps = [
      {
        type: 'function',
        name: 'Step 1',
        function: async (context) => {
          context.step1 = true;
        }
      },
      {
        type: 'function',
        name: 'Step 2',
        function: async (context) => {
          context.step2 = true;
        }
      }
    ];

    const workflowId = await wms.createWorkflow('Test Workflow', steps);
    expect(workflowId).toBeTruthy();

    const context = {};
    const executionId = await wms.startWorkflow(workflowId, context);
    expect(executionId).toBeTruthy();

    const status = await wms.getWorkflowStatus(executionId);
    expect(status.status).toBe('completed');
    expect(context.step1).toBe(true);
    expect(context.step2).toBe(true);
  });

  test('handles parallel steps', async () => {
    const steps = [
      {
        type: 'parallel',
        name: 'Parallel Steps',
        steps: [
          {
            type: 'function',
            name: 'Parallel 1',
            function: async (context) => {
              context.parallel1 = true;
            }
          },
          {
            type: 'function',
            name: 'Parallel 2',
            function: async (context) => {
              context.parallel2 = true;
            }
          }
        ]
      }
    ];

    const workflowId = await wms.createWorkflow('Parallel Workflow', steps);
    const context = {};
    const executionId = await wms.startWorkflow(workflowId, context);
    const status = await wms.getWorkflowStatus(executionId);

    expect(status.status).toBe('completed');
    expect(context.parallel1).toBe(true);
    expect(context.parallel2).toBe(true);
  });

  test('handles conditional steps', async () => {
    const steps = [
      {
        type: 'conditional',
        name: 'Conditional Step',
        condition: (context) => context.shouldExecute,
        then: {
          type: 'function',
          name: 'Then Branch',
          function: async (context) => {
            context.thenExecuted = true;
          }
        },
        else: {
          type: 'function',
          name: 'Else Branch',
          function: async (context) => {
            context.elseExecuted = true;
          }
        }
      }
    ];

    const workflowId = await wms.createWorkflow('Conditional Workflow', steps);
    
    // Test then branch
    let context = { shouldExecute: true };
    let executionId = await wms.startWorkflow(workflowId, context);
    let status = await wms.getWorkflowStatus(executionId);
    expect(status.status).toBe('completed');
    expect(context.thenExecuted).toBe(true);
    expect(context.elseExecuted).toBeUndefined();

    // Test else branch
    context = { shouldExecute: false };
    executionId = await wms.startWorkflow(workflowId, context);
    status = await wms.getWorkflowStatus(executionId);
    expect(status.status).toBe('completed');
    expect(context.thenExecuted).toBeUndefined();
    expect(context.elseExecuted).toBe(true);
  });

  test('creates and uses workflow templates', async () => {
    const template = {
      name: 'Test Template',
      steps: [
        {
          type: 'function',
          name: 'Template Step',
          function: async (context) => {
            context.templateExecuted = true;
          }
        }
      ]
    };

    const templateId = await wms.createWorkflowTemplate('Test Template', template);
    expect(templateId).toBeTruthy();

    const workflowId = await wms.createWorkflow('Template-based Workflow', template.steps);
    const context = {};
    const executionId = await wms.startWorkflow(workflowId, context);
    const status = await wms.getWorkflowStatus(executionId);

    expect(status.status).toBe('completed');
    expect(context.templateExecuted).toBe(true);
  });
});
