import React from 'react';
import PropTypes from 'prop-types';

const ProgressIndicator = ({
  isOpen,
  onClose,
  title,
  message,
  progress,
  showPercentage = true,
  allowCancel = true,
  onCancel
}) => {
  if (!isOpen) return null;

  const percentage = Math.round(progress * 100);

  return (
    <div className="modal-overlay">
      <div className="modal-content progress-indicator">
        <div className="modal-header">
          <h3>{title}</h3>
          {allowCancel && (
            <button className="close-button" onClick={onClose}>×</button>
          )}
        </div>
        
        <div className="modal-body">
          {message && <p className="progress-message">{message}</p>}
          
          <div className="progress-bar-container">
            <div 
              className="progress-bar"
              style={{ width: `${percentage}%` }}
            />
            {showPercentage && (
              <div className="progress-percentage">{percentage}%</div>
            )}
          </div>
        </div>
        
        {allowCancel && (
          <div className="modal-actions">
            <button 
              type="button"
              className="cancel-button"
              onClick={onCancel || onClose}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

ProgressIndicator.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
  message: PropTypes.string,
  progress: PropTypes.number.isRequired,
  showPercentage: PropTypes.bool,
  allowCancel: PropTypes.bool,
  onCancel: PropTypes.func
};

export default ProgressIndicator;
