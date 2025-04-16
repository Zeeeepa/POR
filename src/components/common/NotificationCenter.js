import React, { useState } from 'react';
import PropTypes from 'prop-types';

const NotificationCenter = ({ notifications = [], onNotificationClick, onClearAll }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="notification-center">
      <button 
        className="notification-toggle"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="notification-count">{notifications.length}</span>
        <span className="notification-icon">🔔</span>
      </button>
      
      {isOpen && (
        <div className="notification-panel">
          <div className="notification-header">
            <h3>Notifications</h3>
            {notifications.length > 0 && (
              <button 
                className="clear-all"
                onClick={onClearAll}
              >
                Clear All
              </button>
            )}
          </div>
          
          <div className="notification-list">
            {notifications.length === 0 ? (
              <div className="no-notifications">No new notifications</div>
            ) : (
              notifications.map((notification, index) => (
                <div 
                  key={index}
                  className={`notification-item ${notification.read ? 'read' : 'unread'}`}
                  onClick={() => onNotificationClick(notification)}
                >
                  <div className="notification-title">{notification.title}</div>
                  <div className="notification-message">{notification.message}</div>
                  <div className="notification-time">{notification.time}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

NotificationCenter.propTypes = {
  notifications: PropTypes.arrayOf(
    PropTypes.shape({
      title: PropTypes.string.isRequired,
      message: PropTypes.string.isRequired,
      time: PropTypes.string.isRequired,
      read: PropTypes.bool
    })
  ),
  onNotificationClick: PropTypes.func,
  onClearAll: PropTypes.func
};

export default NotificationCenter;
