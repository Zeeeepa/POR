class WorkflowError extends Error {
  constructor(message) {
    super(message);
    this.name = 'WorkflowError';
  }
}

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

module.exports = {
  WorkflowError,
  ValidationError
};
