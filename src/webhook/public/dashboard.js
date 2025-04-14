/**
 * Dashboard JavaScript
 * Provides interactive functionality for the webhook dashboard
 */

document.addEventListener('DOMContentLoaded', function() {
  // Initialize tooltips
  initTooltips();
  
  // Set up auto-refresh
  setupAutoRefresh();
  
  // Initialize charts if needed
  initCharts();
  
  // Setup event handlers
  setupEventHandlers();
  
  // Check for dark mode preference
  checkDarkMode();
});

/**
 * Initialize Bootstrap tooltips
 */
function initTooltips() {
  const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
  const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => {
    return new bootstrap.Tooltip(tooltipTriggerEl);
  });
}

/**
 * Set up auto-refresh for certain pages
 */
function setupAutoRefresh() {
  // Only auto-refresh the dashboard and events pages
  const path = window.location.pathname;
  if (path === '/dashboard' || path === '/dashboard/events') {
    // Refresh every 30 seconds
    setTimeout(() => {
      window.location.reload();
    }, 30000);
    
    // Show countdown in the footer
    setupRefreshCountdown(30);
  }
}

/**
 * Set up a countdown until the next refresh
 */
function setupRefreshCountdown(seconds) {
  const countdownElement = document.getElementById('refreshCountdown');
  if (!countdownElement) return;
  
  let countdown = seconds;
  
  const intervalId = setInterval(() => {
    countdown--;
    countdownElement.textContent = countdown;
    
    if (countdown <= 0) {
      clearInterval(intervalId);
    }
  }, 1000);
}

/**
 * Initialize charts for data visualization
 */
function initCharts() {
  const eventTypeChart = document.getElementById('eventTypeChart');
  if (!eventTypeChart) return;
  
  // Fetch stats data
  fetch('/dashboard/api/stats')
    .then(response => response.json())
    .then(stats => {
      // Create a pie chart for event types
      const ctx = eventTypeChart.getContext('2d');
      
      // Extract data for the chart
      const eventTypes = Object.keys(stats.byType);
      const eventCounts = Object.values(stats.byType);
      
      // Colors for different event types
      const colors = [
        '#0d6efd', // primary
        '#198754', // success
        '#ffc107', // warning
        '#0dcaf0', // info
        '#6c757d', // secondary
        '#dc3545', // danger
        '#6f42c1', // purple
        '#fd7e14', // orange
      ];
      
      new Chart(ctx, {
        type: 'pie',
        data: {
          labels: eventTypes,
          datasets: [{
            data: eventCounts,
            backgroundColor: eventTypes.map((_, index) => colors[index % colors.length]),
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
            },
            title: {
              display: true,
              text: 'Event Types'
            }
          }
        }
      });
    })
    .catch(error => {
      console.error('Error loading chart data:', error);
      eventTypeChart.parentElement.innerHTML = '<div class="alert alert-danger">Failed to load chart data</div>';
    });
}

/**
 * Set up event handlers for interactive elements
 */
function setupEventHandlers() {
  // Copy payload button
  const copyButtons = document.querySelectorAll('.btn-copy');
  copyButtons.forEach(button => {
    button.addEventListener('click', copyPayload);
  });
  
  // Expand/collapse buttons
  const expandButtons = document.querySelectorAll('.btn-expand');
  expandButtons.forEach(button => {
    button.addEventListener('click', toggleExpand);
  });
  
  // Dark mode toggle
  const darkModeToggle = document.getElementById('darkModeToggle');
  if (darkModeToggle) {
    darkModeToggle.addEventListener('click', toggleDarkMode);
  }
}

/**
 * Copy JSON payload to clipboard
 */
function copyPayload() {
  const payloadText = document.getElementById('payloadCode')?.textContent;
  if (!payloadText) return;
  
  navigator.clipboard.writeText(payloadText)
    .then(() => {
      // Show success feedback
      this.innerHTML = '<i class="bi bi-check2"></i> Copied!';
      this.classList.remove('btn-outline-primary');
      this.classList.add('btn-success');
      
      // Reset button after 2 seconds
      setTimeout(() => {
        this.innerHTML = '<i class="bi bi-clipboard"></i> Copy';
        this.classList.remove('btn-success');
        this.classList.add('btn-outline-primary');
      }, 2000);
    })
    .catch(err => {
      console.error('Failed to copy: ', err);
      alert('Failed to copy payload');
    });
}

/**
 * Toggle JSON payload height between fixed and full
 */
let expanded = false;
function toggleExpand() {
  const preElement = document.querySelector('.event-payload pre');
  if (!preElement) return;
  
  const expandIcon = document.getElementById('expandIcon');
  const expandText = document.getElementById('expandText');
  
  if (expanded) {
    preElement.style.maxHeight = '600px';
    if (expandIcon) expandIcon.classList.replace('bi-arrows-angle-contract', 'bi-arrows-angle-expand');
    if (expandText) expandText.textContent = 'Expand';
  } else {
    preElement.style.maxHeight = 'none';
    if (expandIcon) expandIcon.classList.replace('bi-arrows-angle-expand', 'bi-arrows-angle-contract');
    if (expandText) expandText.textContent = 'Collapse';
  }
  
  expanded = !expanded;
}

/**
 * Check for dark mode preference and set accordingly
 */
function checkDarkMode() {
  // Check if user has dark mode preference in localStorage
  const darkModeEnabled = localStorage.getItem('darkMode') === 'true';
  
  // Check if browser prefers dark mode
  const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  // Apply dark mode if either preference is true
  if (darkModeEnabled || (prefersDarkMode && localStorage.getItem('darkMode') === null)) {
    document.body.classList.add('dark-mode');
    
    // Update toggle button if it exists
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
      darkModeToggle.checked = true;
    }
  }
}

/**
 * Toggle dark mode on/off
 */
function toggleDarkMode() {
  const darkModeEnabled = document.body.classList.toggle('dark-mode');
  localStorage.setItem('darkMode', darkModeEnabled);
}

/**
 * Get appropriate badge color for event type
 */
function getBadgeColor(type) {
  const colors = {
    'push': 'bg-primary',
    'pull_request': 'bg-success',
    'issues': 'bg-warning',
    'issue_comment': 'bg-info',
    'workflow_run': 'bg-secondary',
  };
  return colors[type] || 'bg-dark';
} 