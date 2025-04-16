import React from 'react';
import PropTypes from 'prop-types';

const ConfirmationPrompt = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default'
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className={`modal-content confirmation-prompt ${variant}`}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          <p className="confirmation-message">{message}</p>
        </div>
        
        <div className="modal-actions">
          <button 
            type="button" 
            className="cancel-button"
            onClick={onClose}
          >
            {cancelLabel}
          </button>
          <button 
            type="button"
            className={`confirm-button ${variant}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

ConfirmationPrompt.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
  message: PropTypes.string.isRequired,
  confirmLabel: PropTypes.string,
  cancelLabel: PropTypes.string,
  variant: PropTypes.oneOf(['default', 'danger', 'warning'])
};

export default ConfirmationPrompt;
