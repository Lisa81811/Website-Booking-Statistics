# Hospitality Analytics Dashboard - Backend Setup Guide

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Google Analytics 4 account with API access
- Cloudbeds account with API credentials

## Installation

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

## Configuration

### 1. Google Analytics 4 Setup

1. **Create a Service Account:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing
   - Enable Google Analytics Data API
   - Create a service account with Viewer permissions
   - Download the JSON key file

2. **Configure GA4 Property:**
   - In Google Analytics, go to Admin → Property Settings
   - Copy your Property ID (format: 123456789)
   - Go to Property Access Management
   - Add the service account email with Viewer role

3. **Update .env file:**
```env
GA4_PROPERTY_ID=123456789
GOOGLE_ANALYTICS_KEY_PATH=./service-account-key.json
```

### 2. Cloudbeds API Setup

1. **Get API Credentials:**
   - Log in to your Cloudbeds account
   - Go to Settings → API & Integrations
   - Create a new OAuth2 application
   - Copy Client ID and Client Secret

2. **Generate Access Token:**
   - Use the OAuth2 flow to generate an access token
   - Alternatively, use Cloudbeds' token generator in their dashboard

3. **Update .env file:**
```env
CLOUDBEDS_ACCESS_TOKEN=your_access_token_here
CLOUDBEDS_CLIENT_ID=your_client_id_here
CLOUDBEDS_CLIENT_SECRET=your_client_secret_here
```

### 3. Property Mapping

The system expects the following properties in Cloudbeds:
- Allen
- Potts Point
- Surry Hills
- Central Sydney

Make sure your Cloudbeds properties match these names or update the mapping in `server.js`.

## Running the Server

### Development mode (with auto-reload):
```bash
npm run dev
```

### Production mode:
```bash
npm start
```

The server will run on `http://localhost:3001` by default.

## API Endpoints

### POST /api/dashboard-data
Fetches dashboard data for the specified date range.

**Request Body:**
```json
{
  "startDate": "2026-01-14T00:00:00.000Z",
  "endDate": "2026-02-10T00:00:00.000Z"
}
```

**Response:**
Returns comprehensive dashboard data including:
- Website traffic metrics (from Google Analytics)
- Property performance (from Cloudbeds)
- Booking sources and platforms
- Operational metrics

### GET /api/connection-status
Checks the connection status of both APIs.

**Response:**
```json
{
  "googleAnalytics": {
    "connected": true,
    "lastSync": "2026-02-11T10:30:00.000Z"
  },
  "cloudbeds": {
    "connected": true,
    "lastSync": "2026-02-11T10:30:00.000Z"
  }
}
```

### POST /api/export-pdf
Generates a PDF report of the dashboard data.

**Request Body:**
```json
{
  "data": { /* dashboard data object */ },
  "dateRange": {
    "start": "2026-01-14T00:00:00.000Z",
    "end": "2026-02-10T00:00:00.000Z",
    "label": "Last 28 days"
  }
}
```

**Response:**
Returns a PDF file as a download.

## Troubleshooting

### Google Analytics Connection Issues

1. **"Permission denied" errors:**
   - Verify service account has Viewer access to the GA4 property
   - Check that the service account key file path is correct

2. **"Property not found" errors:**
   - Verify the GA4 Property ID is correct
   - Ensure you're using the numeric Property ID, not the Measurement ID

### Cloudbeds Connection Issues

1. **"Unauthorized" errors:**
   - Verify your access token is valid and not expired
   - Regenerate the access token if needed

2. **"Rate limit exceeded" errors:**
   - Cloudbeds API has rate limits
   - Implement caching or reduce request frequency

### General Issues

1. **CORS errors:**
   - Update `FRONTEND_URL` in `.env` to match your frontend URL
   - Ensure CORS is properly configured in `server.js`

2. **Missing data:**
   - Check that both APIs are returning data for the date range
   - Verify your properties are set up correctly in Cloudbeds

## Data Mapping

### Google Analytics Metrics:
- `sessions` → Total website sessions
- `screenPageViews` → Page views
- `averageSessionDuration` → Avg engagement time
- `newUsers` → New users count
- `conversions` → Used for conversion rate calculation

### Cloudbeds Data:
- Reservations → Bookings, revenue, occupancy
- Properties → Property-level metrics
- Room types → Private room count
- Booking sources → Platform distribution

## Security Notes

- Never commit your `.env` file to version control
- Keep your service account key file secure
- Rotate API credentials regularly
- Use environment variables for all sensitive data

## Support

For issues or questions:
1. Check the Cloudbeds API documentation: https://hotels.cloudbeds.com/api/docs/
2. Check Google Analytics Data API docs: https://developers.google.com/analytics/devguides/reporting/data/v1
3. Review server logs for detailed error messages
