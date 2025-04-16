import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ProjectList from './components/ProjectList';

const App: React.FC = () => {
  return (
    <Router>
      <div className="App">
        <nav>
          <ul>
            <li><a href="/">Home</a></li>
            <li><a href="/projects">Projects</a></li>
          </ul>
        </nav>
        <Routes>
          <Route path="/" element={<div>Welcome to POR</div>} />
          <Route path="/projects" element={<ProjectList />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
