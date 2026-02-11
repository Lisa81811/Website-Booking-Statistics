const express = require('express');
const cors = require('cors');
const PDFDocument = require('pdfkit');
const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Google Analytics Client
const analyticsClient = new BetaAnalyticsDataClient({
  keyFilename: process.env.GOOGLE_ANALYTICS_KEY_PATH
});

// Cloudbeds API configuration
const CLOUDBEDS_API_URL = 'https://api.cloudbeds.com/api/v1.1';
let cloudbedsAccessToken = process.env.CLOUDBEDS_ACCESS_TOKEN;

// Helper function to fetch Google Analytics data
async function fetchGoogleAnalyticsData(startDate, endDate) {
  try {
    const propertyId = process.env.GA4_PROPERTY_ID;
    
    const [response] = await analyticsClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [
        {
          startDate: startDate,
          endDate: endDate,
        },
      ],
      dimensions: [
        { name: 'date' },
        { name: 'country' },
        { name: 'deviceCategory' },
      ],
      metrics: [
        { name: 'sessions' },
        { name: 'screenPageViews' },
        { name: 'averageSessionDuration' },
        { name: 'newUsers' },
        { name: 'conversions' },
      ],
    });

    // Process the response
    let totalSessions = 0;
    let totalPageViews = 0;
    let totalDuration = 0;
    let totalNewUsers = 0;
    let totalConversions = 0;
    const countryStats = {};
    const hourlyStats = {};
    const dailyStats = {};

    response.rows?.forEach((row) => {
      const metricValues = row.metricValues;
      const sessions = parseInt(metricValues[0].value);
      const pageViews = parseInt(metricValues[1].value);
      const duration = parseFloat(metricValues[2].value);
      const newUsers = parseInt(metricValues[3].value);
      const conversions = parseInt(metricValues[4].value);

      totalSessions += sessions;
      totalPageViews += pageViews;
      totalDuration += duration * sessions;
      totalNewUsers += newUsers;
      totalConversions += conversions;

      // Country aggregation
      const country = row.dimensionValues[1].value;
      if (!countryStats[country]) {
        countryStats[country] = { sessions: 0, pageViews: 0 };
      }
      countryStats[country].sessions += sessions;
      countryStats[country].pageViews += pageViews;
    });

    const avgEngagementTime = totalSessions > 0 
      ? Math.floor((totalDuration / totalSessions))
      : 0;

    const conversionRate = totalSessions > 0 
      ? ((totalConversions / totalSessions) * 100).toFixed(2)
      : 0;

    return {
      sessions: totalSessions,
      pageViews: totalPageViews,
      avgEngagementTime: `${Math.floor(avgEngagementTime / 60)}m ${avgEngagementTime % 60}s`,
      newUsers: totalNewUsers,
      conversion: parseFloat(conversionRate),
      countryData: Object.entries(countryStats).map(([country, stats]) => ({
        country,
        sessions: stats.sessions,
        pageViews: stats.pageViews
      })).sort((a, b) => b.sessions - a.sessions).slice(0, 10)
    };
  } catch (error) {
    console.error('Error fetching Google Analytics data:', error);
    throw error;
  }
}

// Helper function to fetch Cloudbeds data
async function fetchCloudbedsData(startDate, endDate) {
  try {
    const headers = {
      'Authorization': `Bearer ${cloudbedsAccessToken}`,
      'Content-Type': 'application/json'
    };

    // Fetch reservations
    const reservationsResponse = await axios.get(`${CLOUDBEDS_API_URL}/getReservations`, {
      headers,
      params: {
        startDate: startDate,
        endDate: endDate,
        includeExtras: true
      }
    });

    // Fetch properties
    const propertiesResponse = await axios.get(`${CLOUDBEDS_API_URL}/getHotels`, {
      headers
    });

    const reservations = reservationsResponse.data.data || [];
    const properties = propertiesResponse.data.data || [];

    // Process reservations by property
    const propertyStats = {};
    const platformStats = {};
    const hourlyBookings = Array(24).fill(0);
    const dailyBookings = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };
    
    let totalRevenue = 0;
    let totalBookings = 0;
    let totalNights = 0;
    let websiteBookings = 0;
    let websiteRevenue = 0;
    let organicBookings = 0;
    let organicRevenue = 0;
    let extensionBookings = 0;
    let extensionRevenue = 0;

    reservations.forEach(reservation => {
      const propertyId = reservation.propertyID;
      const source = reservation.source || 'Direct';
      const revenue = parseFloat(reservation.balance) || 0;
      const nights = reservation.nights || 1;
      
      totalRevenue += revenue;
      totalBookings++;
      totalNights += nights;

      // Property stats
      if (!propertyStats[propertyId]) {
        propertyStats[propertyId] = {
          totalBookings: 0,
          privateRooms: 0,
          revenue: 0,
          occupancy: 0
        };
      }
      propertyStats[propertyId].totalBookings++;
      propertyStats[propertyId].revenue += revenue;
      if (reservation.roomType === 'private') {
        propertyStats[propertyId].privateRooms++;
      }

      // Platform stats
      if (!platformStats[source]) {
        platformStats[source] = 0;
      }
      platformStats[source]++;

      // Source categorization
      if (source === 'Direct' || source === 'Website') {
        websiteBookings++;
        websiteRevenue += revenue;
        
        if (reservation.isOrganic) {
          organicBookings++;
          organicRevenue += revenue;
        } else if (reservation.isExtension) {
          extensionBookings++;
          extensionRevenue += revenue;
        }
      }

      // Hourly and daily distribution
      if (reservation.createdAt) {
        const date = new Date(reservation.createdAt);
        const hour = date.getHours();
        const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
        
        hourlyBookings[hour]++;
        dailyBookings[day]++;
      }
    });

    // Calculate ADR and RevPAR
    const adr = totalBookings > 0 ? totalRevenue / totalBookings : 0;
    const revpar = totalNights > 0 ? totalRevenue / totalNights : 0;

    // Get operational metrics
    const today = new Date();
    const checkIns = reservations.filter(r => 
      new Date(r.startDate).toDateString() === today.toDateString()
    ).length;
    
    const checkOuts = reservations.filter(r => 
      new Date(r.endDate).toDateString() === today.toDateString()
    ).length;
    
    const inHouse = reservations.filter(r => {
      const start = new Date(r.startDate);
      const end = new Date(r.endDate);
      return start <= today && end >= today;
    }).length;

    const noShows = reservations.filter(r => r.status === 'no_show').length;
    const cancellations = reservations.filter(r => r.status === 'canceled').length;

    return {
      propertyData: properties.map(prop => ({
        name: prop.propertyName,
        totalBookings: propertyStats[prop.propertyID]?.totalBookings || 0,
        privateRooms: propertyStats[prop.propertyID]?.privateRooms || 0,
        occupancy: Math.round((propertyStats[prop.propertyID]?.totalBookings / (prop.roomCount || 1)) * 100),
        bedsRemaining: (prop.roomCount || 0) - (propertyStats[prop.propertyID]?.totalBookings || 0)
      })),
      bookingSourceData: [
        { name: 'Total Website', amount: websiteRevenue, count: websiteBookings },
        { name: 'Organic', amount: organicRevenue, count: organicBookings },
        { name: 'Extensions', amount: extensionRevenue, count: extensionBookings }
      ],
      platformData: Object.entries(platformStats).map(([name, value]) => ({
        name,
        value,
        color: '#2d5a3d' // You can assign different colors per platform
      })),
      hourlyData: hourlyBookings.map((bookings, hour) => ({
        hour: `${hour.toString().padStart(2, '0')}:00`,
        bookings
      })),
      dailyData: Object.entries(dailyBookings).map(([day, bookings]) => ({
        day,
        bookings
      })),
      operationalData: {
        checkIns,
        checkOuts,
        inHouse,
        stayOver: inHouse - checkIns,
        noShows,
        cancellations
      },
      adr: parseFloat(adr.toFixed(2)),
      revpar: parseFloat(revpar.toFixed(2))
    };
  } catch (error) {
    console.error('Error fetching Cloudbeds data:', error);
    throw error;
  }
}

// API Endpoints

// Get dashboard data
app.post('/api/dashboard-data', async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    
    const gaStartDate = new Date(startDate).toISOString().split('T')[0];
    const gaEndDate = new Date(endDate).toISOString().split('T')[0];

    // Fetch data from both sources
    const [gaData, cloudbedsData] = await Promise.all([
      fetchGoogleAnalyticsData(gaStartDate, gaEndDate),
      fetchCloudbedsData(gaStartDate, gaEndDate)
    ]);

    // Merge the data
    const dashboardData = {
      websiteTraffic: {
        sessions: gaData.sessions,
        pageViews: gaData.pageViews,
        avgEngagementTime: gaData.avgEngagementTime,
        newUsers: gaData.newUsers,
        adr: cloudbedsData.adr,
        revpar: cloudbedsData.revpar,
        conversion: gaData.conversion
      },
      propertyData: cloudbedsData.propertyData,
      bookingSourceData: cloudbedsData.bookingSourceData,
      countryData: gaData.countryData.map(c => ({
        country: c.country,
        bookings: Math.round(c.sessions / 10), // Estimate bookings from sessions
        revenue: Math.round(c.sessions * cloudbedsData.adr / 10)
      })),
      hourlyData: cloudbedsData.hourlyData,
      dailyData: cloudbedsData.dailyData,
      platformData: cloudbedsData.platformData,
      operationalData: cloudbedsData.operationalData
    };

    res.json(dashboardData);
  } catch (error) {
    console.error('Error in /api/dashboard-data:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// Check API connection status
app.get('/api/connection-status', async (req, res) => {
  const status = {
    googleAnalytics: { connected: false, lastSync: null },
    cloudbeds: { connected: false, lastSync: null }
  };

  // Test Google Analytics connection
  try {
    await analyticsClient.runReport({
      property: `properties/${process.env.GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
      metrics: [{ name: 'sessions' }],
    });
    status.googleAnalytics.connected = true;
    status.googleAnalytics.lastSync = new Date().toISOString();
  } catch (error) {
    console.error('Google Analytics connection failed:', error);
  }

  // Test Cloudbeds connection
  try {
    await axios.get(`${CLOUDBEDS_API_URL}/getHotels`, {
      headers: { 'Authorization': `Bearer ${cloudbedsAccessToken}` }
    });
    status.cloudbeds.connected = true;
    status.cloudbeds.lastSync = new Date().toISOString();
  } catch (error) {
    console.error('Cloudbeds connection failed:', error);
  }

  res.json(status);
});

// Export data as PDF
app.post('/api/export-pdf', async (req, res) => {
  try {
    const { data, dateRange } = req.body;
    
    const doc = new PDFDocument();
    const chunks = [];
    
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(chunks);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=dashboard-report.pdf');
      res.send(pdfBuffer);
    });

    // Add content to PDF
    doc.fontSize(20).text('Website Booking Analytics Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Date Range: ${dateRange.label}`, { align: 'center' });
    doc.text(`${new Date(dateRange.start).toLocaleDateString()} - ${new Date(dateRange.end).toLocaleDateString()}`, { align: 'center' });
    doc.moveDown(2);

    // Website Traffic Section
    doc.fontSize(16).text('Website Traffic');
    doc.moveDown();
    doc.fontSize(10);
    doc.text(`Sessions: ${data.websiteTraffic.sessions.toLocaleString()}`);
    doc.text(`Page Views: ${data.websiteTraffic.pageViews.toLocaleString()}`);
    doc.text(`Avg Engagement Time: ${data.websiteTraffic.avgEngagementTime}`);
    doc.text(`New Users: ${data.websiteTraffic.newUsers.toLocaleString()}`);
    doc.text(`ADR: $${data.websiteTraffic.adr}`);
    doc.text(`RevPAR: $${data.websiteTraffic.revpar}`);
    doc.text(`Conversion: ${data.websiteTraffic.conversion}%`);
    doc.moveDown(2);

    // Property Performance
    doc.fontSize(16).text('Property Performance');
    doc.moveDown();
    doc.fontSize(10);
    data.propertyData.forEach(prop => {
      doc.text(`${prop.name}: ${prop.totalBookings} bookings, ${prop.occupancy}% occupancy, ${prop.bedsRemaining} beds remaining`);
    });
    doc.moveDown(2);

    // Operational Metrics
    doc.fontSize(16).text('Operational Metrics');
    doc.moveDown();
    doc.fontSize(10);
    doc.text(`Check-ins: ${data.operationalData.checkIns}`);
    doc.text(`Check-outs: ${data.operationalData.checkOuts}`);
    doc.text(`In-house: ${data.operationalData.inHouse}`);
    doc.text(`Stay Over: ${data.operationalData.stayOver}`);
    doc.text(`No Shows: ${data.operationalData.noShows}`);
    doc.text(`Cancellations: ${data.operationalData.cancellations}`);

    doc.end();
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
