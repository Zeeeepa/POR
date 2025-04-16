import React from 'react';
import PropTypes from 'prop-types';

const NavigationSidebar = ({ items = [], onItemClick }) => {
  return (
    <nav className="navigation-sidebar">
      <div className="nav-header">
        <h2>POR Project</h2>
      </div>
      <ul className="nav-items">
        {items.map((item, index) => (
          <li key={index} className="nav-item">
            <button 
              onClick={() => onItemClick(item)}
              className="nav-link"
            >
              {item.icon && <span className="nav-icon">{item.icon}</span>}
              <span className="nav-text">{item.text}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
};

NavigationSidebar.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      icon: PropTypes.node,
      text: PropTypes.string.isRequired,
      path: PropTypes.string
    })
  ),
  onItemClick: PropTypes.func
};

export default NavigationSidebar;
