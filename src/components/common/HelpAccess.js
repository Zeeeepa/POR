import React, { useState } from 'react';
import PropTypes from 'prop-types';

const HelpAccess = ({ sections = [], onSectionClick }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSections = sections.filter(section =>
    section.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    section.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="help-access">
      <div className="help-header">
        <h3>Help & Documentation</h3>
        <input
          type="text"
          className="help-search"
          placeholder="Search help topics..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="help-sections">
        {filteredSections.map((section, index) => (
          <div
            key={index}
            className="help-section"
            onClick={() => onSectionClick(section)}
          >
            <h4 className="section-title">{section.title}</h4>
            <p className="section-description">{section.description}</p>
            {section.tags && (
              <div className="section-tags">
                {section.tags.map((tag, tagIndex) => (
                  <span key={tagIndex} className="tag">{tag}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

HelpAccess.propTypes = {
  sections: PropTypes.arrayOf(
    PropTypes.shape({
      title: PropTypes.string.isRequired,
      description: PropTypes.string.isRequired,
      tags: PropTypes.arrayOf(PropTypes.string)
    })
  ),
  onSectionClick: PropTypes.func.isRequired
};

export default HelpAccess;
