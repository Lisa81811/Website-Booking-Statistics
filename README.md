# 📊 Website Booking Analytics Dashboard

A comprehensive analytics dashboard for hospitality businesses that integrates **Google Analytics 4** and **Cloudbeds** to provide real-time insights into website traffic, bookings, and property performance.

![Dashboard Preview](https://via.placeholder.com/800x400/fdfcfb/2d5a3d?text=Website+Booking+Analytics+Dashboard)

## ✨ Features

### 📈 Real-Time Analytics
- **Website Traffic Metrics**: Sessions, page views, engagement time, new users
- **Booking Performance**: ADR, RevPAR, conversion rates
- **Property Insights**: Occupancy, bookings, beds remaining across all properties
- **Operational Metrics**: Check-ins, check-outs, in-house guests, no-shows, cancellations

### 📅 Flexible Date Filtering
- Preset ranges: Today, Yesterday, Last 7/14/28/30 days
- Week-based: This week, Last week
- Month-based: This month, Last month
- Custom date range selector

### 📊 Visual Breakdowns
- **By Country**: Bookings and revenue distribution
- **By Hour**: Hourly booking patterns
- **By Day**: Daily booking trends
- **By Platform**: Booking.com, Agoda, Expedia, Direct Website, etc.

### 💾 Export Capabilities
- **CSV Export**: Download raw data for analysis
- **PDF Export**: Professional reports for presentations

### 🔌 API Integration Status
- Real-time connection monitoring
- Visual indicators for Google Analytics and Cloudbeds
- Last sync timestamps

## 🚀 Quick Start

### Prerequisites
- Node.js v16 or higher
- Google Analytics 4 account with API access
- Cloudbeds account with API credentials

### Installation

1. **Run the automated setup:**
   ```bash
   chmod +x setup.sh
   ./setup.sh
   ```

2. **Configure API credentials:**
   Edit `backend/.env` with your:
   - Google Analytics Property ID
   - Service account key path
   - Cloudbeds access token

3. **Start the application:**
   ```bash
   ./start-all.sh
   ```
   
   Or start separately:
   ```bash
   # Terminal 1 - Backend
   ./start-backend.sh
   
   # Terminal 2 - Frontend
   ./start-frontend.sh
   ```

4. **Open in browser:**
   Navigate to `http://localhost:3000`

## 📁 Project Structure

```
hospitality-analytics/
├── frontend/                 # React + Vite frontend
│   ├── src/
│   │   ├── Dashboard.jsx    # Main dashboard component
│   │   └── main.jsx         # React entry point
│   ├── index.html           # HTML template
│   ├── package.json         # Frontend dependencies
│   └── vite.config.js       # Vite configuration
│
├── backend/                  # Node.js + Express backend
│   ├── server.js            # API server with integrations
│   ├── package.json         # Backend dependencies
│   ├── .env.example         # Environment variables template
│   └── README.md            # Backend setup guide
│
├── SETUP_GUIDE.md           # Detailed setup instructions
├── setup.sh                 # Automated setup script
└── README.md                # This file
```

## 🔧 Configuration

### Google Analytics 4 Setup

1. Create a service account in Google Cloud Console
2. Enable Google Analytics Data API
3. Download service account JSON key
4. Add service account email to GA4 property with Viewer role
5. Copy Property ID from GA4 settings

Update `backend/.env`:
```env
GA4_PROPERTY_ID=123456789
GOOGLE_ANALYTICS_KEY_PATH=./service-account-key.json
```

### Cloudbeds Setup

1. Login to Cloudbeds dashboard
2. Go to Settings → API & Integrations
3. Create OAuth2 application
4. Generate access token
5. Copy Client ID, Secret, and Access Token

Update `backend/.env`:
```env
CLOUDBEDS_ACCESS_TOKEN=your_access_token
CLOUDBEDS_CLIENT_ID=your_client_id
CLOUDBEDS_CLIENT_SECRET=your_client_secret
```

## 🎯 Usage

### Viewing Data
1. Select date range using preset buttons or custom picker
2. Click "Update" to apply date filter
3. Data automatically refreshes across all sections

### Monitoring Connections
1. Click hamburger menu (☰) in top right
2. Check connection status (green = connected)
3. View last sync timestamps

### Exporting Data
1. Open hamburger menu
2. Choose "Download as CSV" or "Download as PDF"
3. File downloads with date range in filename

## 📊 Properties Tracked

The dashboard tracks four properties by default:
- Allen
- Potts Point
- Surry Hills
- Central Sydney

To modify properties, edit the mapping in `backend/server.js`.

## 🔒 Security

- ✅ All sensitive data stored in environment variables
- ✅ API credentials never committed to repository
- ✅ Service account keys kept secure
- ✅ CORS properly configured
- ✅ Production-ready security headers

## 🛠️ Tech Stack

### Frontend
- **React 18** - UI framework
- **Vite** - Build tool
- **Recharts** - Chart library
- **Custom CSS** - Warm, minimal design

### Backend
- **Node.js** - Runtime
- **Express** - Web framework
- **Google Analytics Data API** - Traffic metrics
- **Cloudbeds API** - Booking data
- **PDFKit** - PDF generation

## 📖 Documentation

- [Detailed Setup Guide](SETUP_GUIDE.md) - Complete configuration instructions
- [Backend Documentation](backend/README.md) - API endpoints and integration details
- [Google Analytics API Docs](https://developers.google.com/analytics/devguides/reporting/data/v1)
- [Cloudbeds API Docs](https://hotels.cloudbeds.com/api/docs/)

## 🐛 Troubleshooting

### Frontend won't start
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### Backend connection errors
1. Verify `.env` file exists and has correct credentials
2. Check service account key file path is correct
3. Ensure APIs are enabled in Google Cloud Console
4. Verify Cloudbeds token hasn't expired

### No data showing
1. Check API connection status in hamburger menu
2. Verify date range has data
3. Check browser console for errors
4. Review backend logs

### CORS errors
1. Ensure backend is running on port 3001
2. Check `vite.config.js` proxy configuration
3. Verify `FRONTEND_URL` in backend `.env`

## 🚢 Production Deployment

### Frontend (Vercel/Netlify)
```bash
cd frontend
npm run build
# Deploy dist/ folder
```

### Backend (Heroku/Railway/DigitalOcean)
```bash
cd backend
# Set environment variables in hosting platform
# Deploy via git or platform CLI
```

## 📝 License

This project is proprietary. All rights reserved.

## 🤝 Support

For issues or questions:
1. Check [SETUP_GUIDE.md](SETUP_GUIDE.md) for detailed instructions
2. Review [backend/README.md](backend/README.md) for API-specific help
3. Consult API documentation for Google Analytics and Cloudbeds

## 🎨 Design

The dashboard features a warm, minimal aesthetic inspired by Notion:
- Soft warm white backgrounds
- Deep green accents (#2d5a3d)
- Elegant serif headings (Crimson Pro)
- Clean sans-serif body text (DM Sans)
- Subtle shadows and hover effects

---

Made with ❤️ for hospitality businesses
