import React from 'react';

const ProjectList: React.FC = () => {
  return (
    <div className="project-list">
      <h2>Projects</h2>
      <div className="project-grid">
        {/* Project items will be rendered here */}
        <div className="project-item">
          <h3>Sample Project</h3>
          <p>Status: Not Initialized</p>
        </div>
      </div>
    </div>
  );
};

export default ProjectList;
