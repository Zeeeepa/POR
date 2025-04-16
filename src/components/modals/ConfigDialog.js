import React from 'react';
import PropTypes from 'prop-types';

const ConfigDialog = ({
  isOpen,
  onClose,
  onSave,
  title,
  description,
  fields = [],
  values = {},
  onChange
}) => {
  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(values);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content config-dialog">
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        {description && (
          <div className="modal-description">{description}</div>
        )}

        <form onSubmit={handleSubmit}>
          {fields.map((field, index) => (
            <div key={index} className="form-field">
              <label htmlFor={field.name}>{field.label}</label>
              {field.type === 'select' ? (
                <select
                  id={field.name}
                  value={values[field.name] || ''}
                  onChange={(e) => onChange(field.name, e.target.value)}
                >
                  {field.options.map((option, optIndex) => (
                    <option key={optIndex} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.type || 'text'}
                  id={field.name}
                  value={values[field.name] || ''}
                  onChange={(e) => onChange(field.name, e.target.value)}
                  placeholder={field.placeholder}
                  required={field.required}
                />
              )}
              {field.description && (
                <div className="field-description">{field.description}</div>
              )}
            </div>
          ))}
          
          <div className="modal-actions">
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
};

ConfigDialog.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
  description: PropTypes.string,
  fields: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      type: PropTypes.string,
      placeholder: PropTypes.string,
      required: PropTypes.bool,
      description: PropTypes.string,
      options: PropTypes.arrayOf(
        PropTypes.shape({
          value: PropTypes.string.isRequired,
          label: PropTypes.string.isRequired
        })
      )
    })
  ),
  values: PropTypes.object,
  onChange: PropTypes.func.isRequired
};

export default ConfigDialog;
