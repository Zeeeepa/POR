import React from 'react';
import PropTypes from 'prop-types';

const StatusBar = ({ status, message, onAction }) => {
  const statusClasses = {
    success: 'status-success',
    warning: 'status-warning',
    error: 'status-error',
    info: 'status-info'
  };

  return (
    <div className={`status-bar ${statusClasses[status] || ''}`}>
      <span className="status-message">{message}</span>
      {onAction && (
        <button 
          className="status-action"
          onClick={onAction}
        >
          Action
        </button>
      )}
    </div>
  );
};

StatusBar.propTypes = {
  status: PropTypes.oneOf(['success', 'warning', 'error', 'info']),
  message: PropTypes.string.isRequired,
  onAction: PropTypes.func
};

export default StatusBar;
