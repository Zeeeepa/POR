import React, { useState } from 'react';
import {
  Box,
  Tab,
  Tabs,
  TextField,
  Button,
  IconButton,
  Typography,
  CircularProgress,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import SearchIcon from '@mui/icons-material/Search';
import { styled } from '@mui/material/styles';
import { useProject } from './ProjectContext';
import { ProjectListProps } from './types';

const ProjectTabPanel = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  marginTop: theme.spacing(2),
}));

const SearchBar = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  marginBottom: theme.spacing(2),
}));

const StatusIndicator = styled('span')<{ initialized: boolean }>(
  ({ theme, initialized }) => ({
    display: 'inline-block',
    width: 8,
    height: 8,
    borderRadius: '50%',
    backgroundColor: initialized
      ? theme.palette.success.main
      : theme.palette.warning.main,
    marginRight: theme.spacing(1),
  })
);

const TabLabel = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
}));

export const ProjectList: React.FC<ProjectListProps> = ({ onProjectSelect }) => {
  const {
    projects,
    selectedProject,
    setSelectedProject,
    importProjects,
  } = useProject();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState(0);
  const [isImporting, setIsImporting] = useState(false);

  const handleProjectImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files?.length) return;

    setIsImporting(true);
    try {
      await importProjects(files);
    } catch (error) {
      console.error('Error importing projects:', error);
      // TODO: Add error handling/notification
    } finally {
      setIsImporting(false);
    }
  };

  const filteredProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setSelectedTab(newValue);
    if (filteredProjects[newValue]) {
      setSelectedProject(filteredProjects[newValue]);
      onProjectSelect?.(filteredProjects[newValue]);
    }
  };

  return (
    <Box>
      <SearchBar>
        <TextField
          fullWidth
          variant="outlined"
          size="small"
          placeholder="Search projects..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: <SearchIcon color="action" />,
          }}
        />
        <Button
          variant="contained"
          component="label"
          disabled={isImporting}
          startIcon={isImporting && <CircularProgress size={20} />}
        >
          Import Projects
          <input
            type="file"
            multiple
            hidden
            onChange={handleProjectImport}
            accept=".json,.yaml,.yml"
          />
        </Button>
      </SearchBar>

      {filteredProjects.length > 0 ? (
        <>
          <Tabs
            value={selectedTab}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            {filteredProjects.map((project) => (
              <Tab
                key={project.id}
                label={
                  <TabLabel>
                    <StatusIndicator initialized={project.isInitialized} />
                    {project.name}
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        // TODO: Implement settings dialog
                        console.log('Open settings for:', project.id);
                      }}
                    >
                      <SettingsIcon fontSize="small" />
                    </IconButton>
                  </TabLabel>
                }
              />
            ))}
          </Tabs>

          {filteredProjects.map((project, index) => (
            <ProjectTabPanel
              key={project.id}
              role="tabpanel"
              hidden={selectedTab !== index}
              id={`project-tabpanel-${index}`}
              aria-labelledby={`project-tab-${index}`}
            >
              {selectedTab === index && (
                <Box>
                  <Typography variant="h6" gutterBottom>
                    {project.name}
                  </Typography>
                  <Typography color="textSecondary">
                    Status: {project.isInitialized ? 'Initialized' : 'Not Initialized'}
                  </Typography>
                  <Typography color="textSecondary">
                    Templates: {project.templateStatus.completed} / {project.templateStatus.total}
                  </Typography>
                </Box>
              )}
            </ProjectTabPanel>
          ))}
        </>
      ) : (
        <Typography variant="body1" color="textSecondary" align="center" sx={{ mt: 4 }}>
          No projects found. Import projects to get started.
        </Typography>
      )}
    </Box>
  );
};

export default ProjectList;
