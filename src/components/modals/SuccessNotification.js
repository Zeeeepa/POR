import React, { useEffect } from 'react';
import PropTypes from 'prop-types';

const SuccessNotification = ({
  isOpen,
  onClose,
  title = 'Success',
  message,
  autoClose = true,
  autoCloseDelay = 3000,
  showIcon = true
}) => {
  useEffect(() => {
    if (isOpen && autoClose) {
      const timer = setTimeout(onClose, autoCloseDelay);
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoClose, autoCloseDelay, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay success-notification-overlay">
      <div className="modal-content success-notification">
        <div className="modal-header">
          {showIcon && <span className="success-icon">✓</span>}
          <h3>{title}</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          <p className="success-message">{message}</p>
        </div>
        
        {!autoClose && (
          <div className="modal-actions">
            <button 
              type="button"
              className="close-button"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

SuccessNotification.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.string,
  message: PropTypes.string.isRequired,
  autoClose: PropTypes.bool,
  autoCloseDelay: PropTypes.number,
  showIcon: PropTypes.bool
};

export default SuccessNotification;
