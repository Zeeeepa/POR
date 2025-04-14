# GitHub Webhook Dashboard

A modern, responsive web UI for monitoring GitHub webhook events.

## Features

- Real-time monitoring of webhook events
- Detailed information for each event type
- Filtering and searching capabilities
- Event payload viewer with syntax highlighting
- Statistics and visualizations
- Dark mode support
- Responsive design for desktop and mobile
- Auto-refresh for real-time updates

## Screenshots

### Dashboard Home
![Dashboard Home](https://via.placeholder.com/800x450?text=Dashboard+Home)

### Events List
![Events List](https://via.placeholder.com/800x450?text=Events+List)

### Event Details
![Event Details](https://via.placeholder.com/800x450?text=Event+Details)

## Setup

The dashboard is automatically integrated when you run the webhook server. No additional setup is required.

```javascript
// In your webhook server file
const WebhookServer = require('./webhookServer');
const setupDashboard = require('./dashboard');

// Initialize webhook server
const webhookServer = new WebhookServer({ /* options */ });

// Set up dashboard on the webhook server
setupDashboard(webhookServer.app, webhookServer);

// Start the server
webhookServer.start(true);
```

## Accessing the Dashboard

The dashboard is available at the `/dashboard` path on your webhook server:

- Local: `http://localhost:{PORT}/dashboard`
- Public (via ngrok): `https://{NGROK_URL}/dashboard`

## Dashboard Pages

### Home Page

The dashboard home page displays:
- Server status information
- Statistics on received events
- Recent event activity
- Event type breakdown

### Events Page

The events page lists all received webhook events with filtering options:
- Filter by event type (push, pull_request, issues, etc.)
- Filter by repository
- Limit the number of displayed events

### Event Detail Page

The event detail page shows comprehensive information about a specific event:
- Event metadata (type, repository, sender, etc.)
- Timestamp information
- Full JSON payload with syntax highlighting
- Copy payload functionality

## API Endpoints

The dashboard also provides API endpoints to access event data programmatically:

- `GET /dashboard/api/events` - Get a list of events
- `GET /dashboard/api/stats` - Get event statistics
- `GET /dashboard/api/server-info` - Get server information

## Technical Details

The dashboard is built using:
- Express.js for the server
- EJS templates for rendering
- Bootstrap 5 for responsive design
- Highlight.js for JSON syntax highlighting
- Chart.js for data visualization (optional)
- Moment.js for time formatting

## Customization

You can customize the dashboard by modifying the EJS templates in the `views` directory and the CSS in the `public` directory.

## Dependencies

Required NPM packages:
- express
- ejs
- moment
- chart.js (optional)

## License

This dashboard is released under the MIT License. 