import React from 'react';
import { Routes, Route } from 'react-router-dom';
import NavigationSidebar from '../../components/common/NavigationSidebar';
import StatusBar from '../../components/common/StatusBar';
import NotificationCenter from '../../components/common/NotificationCenter';
import QuickActionToolbar from '../../components/common/QuickActionToolbar';
import ProjectList from '../../components/ProjectManagement/ProjectList';
import PhaseManagement from '../../components/PhaseManagement/PhaseManagement';
import TemplateManagement from '../../components/template/TemplateManagement';
import SystemConfig from '../../components/SystemConfig/GlobalSettings';
import Dashboard from '../../components/analytics/Dashboard';

const App: React.FC = () => {
  return (
    <div className="app-container">
      <NavigationSidebar />
      <StatusBar />
      <NotificationCenter />
      <QuickActionToolbar />
      
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/projects" element={<ProjectList />} />
          <Route path="/phases" element={<PhaseManagement />} />
          <Route path="/templates" element={<TemplateManagement />} />
          <Route path="/settings" element={<SystemConfig />} />
        </Routes>
      </main>
    </div>
  );
};

export default App;
