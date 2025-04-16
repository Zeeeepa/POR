import React from 'react';
import PropTypes from 'prop-types';

const ErrorMessage = ({
  isOpen,
  onClose,
  title = 'Error',
  message,
  details,
  onRetry
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content error-message">
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          <div className="error-icon">⚠️</div>
          <p className="error-message">{message}</p>
          {details && (
            <div className="error-details">
              <button 
                type="button"
                className="details-toggle"
                onClick={() => {
                  const detailsElement = document.querySelector('.details-content');
                  detailsElement.style.display = 
                    detailsElement.style.display === 'none' ? 'block' : 'none';
                }}
              >
                Show Details
              </button>
              <pre className="details-content" style={{ display: 'none' }}>
                {typeof details === 'string' ? details : JSON.stringify(details, null, 2)}
              </pre>
            </div>
          )}
        </div>
        
        <div className="modal-actions">
          {onRetry && (
            <button 
              type="button"
              className="retry-button"
              onClick={onRetry}
            >
              Retry
            </button>
          )}
          <button 
            type="button"
            className="close-button"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

ErrorMessage.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.string,
  message: PropTypes.string.isRequired,
  details: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  onRetry: PropTypes.func
};

export default ErrorMessage;
