const { ValidationError } = require('./errors');

/**
 * Validate workflow configuration
 * @param {Object} workflow - Workflow configuration
 * @throws {ValidationError} If validation fails
 */
async function validateWorkflow(workflow) {
  if (!workflow.name) {
    throw new ValidationError('Workflow name is required');
  }
  if (!Array.isArray(workflow.steps) || workflow.steps.length === 0) {
    throw new ValidationError('Workflow must have at least one step');
  }

  workflow.steps.forEach((step, index) => {
    if (!step.type) {
      throw new ValidationError(`Step ${index} must have a type`);
    }
    if (step.type === 'function' && typeof step.function !== 'function') {
      throw new ValidationError(`Step ${index} must have a valid function`);
    }
    if (step.type === 'parallel' && (!Array.isArray(step.steps) || step.steps.length === 0)) {
      throw new ValidationError(`Parallel step ${index} must have at least one substep`);
    }
    if (step.type === 'conditional') {
      if (typeof step.condition !== 'function') {
        throw new ValidationError(`Conditional step ${index} must have a valid condition function`);
      }
      if (!step.then) {
        throw new ValidationError(`Conditional step ${index} must have a 'then' branch`);
      }
    }
  });
}

/**
 * Validate template configuration
 * @param {Object} template - Template configuration
 * @throws {ValidationError} If validation fails
 */
async function validateTemplate(template) {
  if (!template.name) {
    throw new ValidationError('Template name is required');
  }
  if (!template.workflow) {
    throw new ValidationError('Template must include a workflow configuration');
  }
  await validateWorkflow(template.workflow);
}

module.exports = {
  validateWorkflow,
  validateTemplate
};
