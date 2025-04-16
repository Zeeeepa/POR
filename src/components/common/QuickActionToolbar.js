import React from 'react';
import PropTypes from 'prop-types';

const QuickActionToolbar = ({ actions = [], onActionClick }) => {
  return (
    <div className="quick-action-toolbar">
      {actions.map((action, index) => (
        <button
          key={index}
          className={`quick-action-button ${action.variant || 'default'}`}
          onClick={() => onActionClick(action)}
          disabled={action.disabled}
          title={action.tooltip}
        >
          {action.icon && <span className="action-icon">{action.icon}</span>}
          <span className="action-label">{action.label}</span>
        </button>
      ))}
    </div>
  );
};

QuickActionToolbar.propTypes = {
  actions: PropTypes.arrayOf(
    PropTypes.shape({
      icon: PropTypes.node,
      label: PropTypes.string.isRequired,
      variant: PropTypes.string,
      disabled: PropTypes.bool,
      tooltip: PropTypes.string
    })
  ),
  onActionClick: PropTypes.func.isRequired
};

export default QuickActionToolbar;
