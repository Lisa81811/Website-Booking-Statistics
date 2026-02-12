import express from 'express';
import cors from 'cors';
import PDFDocument from 'pdfkit';
import axios from 'axios';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { BetaAnalyticsDataClient } from '@google-analytics/data';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from current directory
app.use(express.static(__dirname));

// Google Analytics configuration
const GA_PROPERTY_ID = '460526176';
const analyticsDataClient = new BetaAnalyticsDataClient({
  keyFilename: join(__dirname, 'service_account.json')
});

// Fetch Google Analytics data for a date range
async function fetchGoogleAnalyticsData(startDate, endDate) {
  try {
    console.log(`Fetching GA data from ${startDate} to ${endDate}...`);

    const [response] = await analyticsDataClient.runReport({
      property: `properties/${GA_PROPERTY_ID}`,
      dateRanges: [{ startDate, endDate }],
      metrics: [
        { name: 'sessions' },
        { name: 'screenPageViews' },
        { name: 'newUsers' },
        { name: 'averageSessionDuration' },
        { name: 'activeUsers' },
        { name: 'engagedSessions' },
        { name: 'bounceRate' },
        { name: 'conversions' }
      ]
    });

    const row = response.rows?.[0];
    if (!row) {
      console.log('  No GA data returned');
      return null;
    }

    const sessions = parseInt(row.metricValues[0].value) || 0;
    const pageViews = parseInt(row.metricValues[1].value) || 0;
    const newUsers = parseInt(row.metricValues[2].value) || 0;
    const avgSessionDurationSec = parseFloat(row.metricValues[3].value) || 0;
    const activeUsers = parseInt(row.metricValues[4].value) || 0;
    const engagedSessions = parseInt(row.metricValues[5].value) || 0;
    const bounceRate = parseFloat(row.metricValues[6].value) || 0;
    const conversions = parseInt(row.metricValues[7].value) || 0;

    // Format avg session duration as "Xm Ys"
    const mins = Math.floor(avgSessionDurationSec / 60);
    const secs = Math.round(avgSessionDurationSec % 60);
    const avgEngagementTime = `${mins}m ${secs}s`;

    // Fetch page path breakdown for top pages
    const [pageResponse] = await analyticsDataClient.runReport({
      property: `properties/${GA_PROPERTY_ID}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'pagePath' }],
      metrics: [
        { name: 'screenPageViews' },
        { name: 'sessions' }
      ],
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit: 10
    });

    const topPages = (pageResponse.rows || []).map(r => ({
      path: r.dimensionValues[0].value,
      views: parseInt(r.metricValues[0].value),
      sessions: parseInt(r.metricValues[1].value)
    }));

    // Fetch daily sessions for trend data
    const [dailyResponse] = await analyticsDataClient.runReport({
      property: `properties/${GA_PROPERTY_ID}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'date' }],
      metrics: [
        { name: 'sessions' },
        { name: 'screenPageViews' },
        { name: 'newUsers' }
      ],
      orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }]
    });

    const dailyTrend = (dailyResponse.rows || []).map(r => ({
      date: r.dimensionValues[0].value,
      sessions: parseInt(r.metricValues[0].value),
      pageViews: parseInt(r.metricValues[1].value),
      newUsers: parseInt(r.metricValues[2].value)
    }));

    const gaData = {
      sessions,
      pageViews,
      newUsers,
      activeUsers,
      avgEngagementTime,
      engagedSessions,
      bounceRate: parseFloat((bounceRate * 100).toFixed(1)),
      conversions,
      topPages,
      dailyTrend
    };

    console.log(`  ✓ GA: ${sessions} sessions, ${pageViews} page views, ${newUsers} new users`);
    return gaData;
  } catch (error) {
    console.error('Error fetching Google Analytics data:', error.message);
    return null;
  }
}

// Cloudbeds API configuration
const CLOUDBEDS_API_URL = 'https://api.cloudbeds.com/api/v1.3';

// Load all properties from environment variables
const properties = [];
for (let i = 1; i <= 5; i++) {
  const id = process.env[`PROPERTY_${i}_ID`];
  const name = process.env[`PROPERTY_${i}_NAME`];
  const apiKey = process.env[`PROPERTY_${i}_API_KEY`];

  if (id && name && apiKey) {
    properties.push({ id, name, apiKey });
  }
}

console.log(`Loaded ${properties.length} properties:`, properties.map(p => p.name));

// Rate limiting helper - add delay between requests
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper function to fetch all reservations for a property with pagination
async function fetchAllReservations(property, startDate, endDate, headers) {
  let allReservations = [];
  let pageNumber = 1;
  let hasMorePages = true;

  while (hasMorePages) {
    const response = await axios.get(`${CLOUDBEDS_API_URL}/getReservationsWithRateDetails`, {
      headers,
      params: {
        propertyID: property.id,
        resultsFrom: `${startDate} 00:00:00`,
        resultsTo: `${endDate} 23:59:59`,
        excludeStatuses: 'canceled',
        pageNumber,
        pageSize: 100
      }
    });

    const reservations = response.data.data || [];
    allReservations = allReservations.concat(reservations);

    // Check if there are more pages
    const totalCount = response.data.count || 0;
    hasMorePages = allReservations.length < totalCount;
    pageNumber++;

    if (hasMorePages) {
      console.log(`  Fetching page ${pageNumber} for ${property.name}...`);
      await delay(150); // Rate limiting between pages (10 req/sec = ~100ms, use 150ms to be safe)
    }
  }

  return allReservations;
}

// Helper function to fetch data from a single property for date range
async function fetchPropertyData(property, startDate, endDate) {
  try {
    const headers = {
      'Authorization': `Bearer ${property.apiKey}`,
      'X-PROPERTY-ID': property.id,
      'Content-Type': 'application/json'
    };

    console.log(`Fetching data for ${property.name} from ${startDate} to ${endDate}...`);

    // Fetch all reservations (with pagination)
    const reservations = await fetchAllReservations(property, startDate, endDate, headers);

    // Fetch no-shows for the date range
    const noShowResponse = await axios.get(`${CLOUDBEDS_API_URL}/getReservations`, {
      headers,
      params: {
        propertyID: property.id,
        status: 'no_show',
        checkInFrom: startDate,
        checkInTo: endDate,
        pageSize: 100
      }
    });

    console.log(`  ✓ Fetched ${reservations.length} reservations and ${noShowResponse.data.count || 0} no-shows`);

    return {
      propertyId: property.id,
      propertyName: property.name,
      reservations,
      noShowCount: noShowResponse.data.count || 0
    };
  } catch (error) {
    console.error(`Error fetching data for ${property.name}:`, error.response?.data || error.message);
    return {
      propertyId: property.id,
      propertyName: property.name,
      reservations: [],
      noShowCount: 0,
      error: error.message
    };
  }
}

// Helper function to fetch and aggregate Cloudbeds data from all properties
async function fetchCloudbedsData(startDate, endDate) {
  try {
    console.log(`Fetching data from ${startDate} to ${endDate} for ${properties.length} properties...`);

    // Fetch data for ALL properties in parallel (Cloudbeds supports ~10 req/sec)
    const allPropertyData = await Promise.all(
      properties.map(property => fetchPropertyData(property, startDate, endDate))
    );

    // Initialize aggregation structures
    const propertyStats = {};
    const countryStats = {};
    const platformStats = {};
    const hourlyBookings = Array(24).fill(0);
    const dailyBookings = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };

    let totalBookings = 0;
    let totalRevenue = 0;
    let websiteRevenue = 0;
    let websiteBookings = 0;
    let privateRooms = 0;
    let noShows = 0;
    let checkIns = 0;
    let checkOuts = 0;

    // Process all fetched data
    allPropertyData.forEach(propData => {
      const { reservations, noShowCount, propertyId, propertyName } = propData;

      // Initialize property stats
      if (!propertyStats[propertyId]) {
        propertyStats[propertyId] = {
          name: propertyName,
          totalBookings: 0,
          privateRooms: 0,
          revenue: 0,
          checkIns: 0,
          checkOuts: 0
        };
      }

      noShows += noShowCount;

      // Process reservations
      reservations.forEach(reservation => {
        const source = reservation.sourceName || 'Unknown';
        const revenue = parseFloat(reservation.total || 0);
        const guestCountry = reservation.guestCountry || 'Unknown';
        const status = reservation.status || '';

        // Count total bookings (exclude no-shows which are counted separately)
        if (status.toLowerCase() !== 'no_show') {
          totalBookings++;
          propertyStats[propertyId].totalBookings++;
        }

        totalRevenue += revenue;
        propertyStats[propertyId].revenue += revenue;

        // Track check-ins and check-outs within date range
        const checkIn = reservation.startDate ? new Date(reservation.startDate) : null;
        const checkOut = reservation.endDate ? new Date(reservation.endDate) : null;
        const rangeStart = new Date(startDate);
        const rangeEnd = new Date(endDate);

        if (checkIn && checkIn >= rangeStart && checkIn <= rangeEnd) {
          checkIns++;
          propertyStats[propertyId].checkIns++;
        }
        if (checkOut && checkOut >= rangeStart && checkOut <= rangeEnd) {
          checkOuts++;
          propertyStats[propertyId].checkOuts++;
        }

        // Country stats
        if (!countryStats[guestCountry]) {
          countryStats[guestCountry] = { bookings: 0, revenue: 0 };
        }
        countryStats[guestCountry].bookings++;
        countryStats[guestCountry].revenue += revenue;

        // Platform/Source stats
        if (!platformStats[source]) {
          platformStats[source] = { bookings: 0, revenue: 0 };
        }
        platformStats[source].bookings++;
        platformStats[source].revenue += revenue;

        // Website bookings
        if (source.toLowerCase().includes('website') || source.toLowerCase().includes('booking engine')) {
          websiteBookings++;
          websiteRevenue += revenue;
        }

        // Private rooms count
        const rooms = reservation.rooms || [];
        rooms.forEach(room => {
          const roomType = (room.roomTypeName || '').toLowerCase();
          if (roomType.includes('private') || roomType.includes('single') ||
              roomType.includes('double') || roomType.includes('queen') || roomType.includes('king')) {
            privateRooms++;
            propertyStats[propertyId].privateRooms++;
          }
        });

        // Hourly and daily distribution (based on booking creation time)
        const dateCreated = reservation.dateCreatedUTC || reservation.dateCreated;
        if (dateCreated) {
          const date = new Date(dateCreated);
          const hour = date.getHours();
          const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];

          hourlyBookings[hour]++;
          dailyBookings[day]++;
        }
      });
    });

    // Calculate metrics
    const adr = totalBookings > 0 ? totalRevenue / totalBookings : 0;
    const estimatedOccupancy = 75; // Placeholder - would need room inventory data to calculate accurately
    const revpar = adr * (estimatedOccupancy / 100);

    console.log(`✓ Aggregated ${totalBookings} bookings, $${totalRevenue.toFixed(2)} revenue from all properties`);

    return {
      propertyData: Object.entries(propertyStats).map(([propId, stats]) => ({
        name: stats.name,
        totalBookings: stats.totalBookings,
        privateRooms: stats.privateRooms,
        occupancy: Math.round((stats.totalBookings / totalBookings) * 100) || 0, // Relative occupancy
        bedsRemaining: 0 // Would need room inventory data
      })),
      bookingSourceData: [
        { name: 'Website/Booking Engine', amount: websiteRevenue, count: websiteBookings },
        { name: 'Other Channels', amount: totalRevenue - websiteRevenue, count: totalBookings - websiteBookings }
      ],
      platformData: Object.entries(platformStats)
        .map(([name, data]) => ({
          name,
          value: data.bookings,
          revenue: data.revenue,
          color: '#2d5a3d'
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10),
      countryData: Object.entries(countryStats)
        .map(([country, stats]) => ({
          country,
          bookings: stats.bookings,
          revenue: Math.round(stats.revenue)
        }))
        .sort((a, b) => b.bookings - a.bookings)
        .slice(0, 10),
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
        inHouse: 0, // Would need current snapshot data
        stayOver: 0, // Would need current snapshot data
        noShows,
        cancellations: 0 // Excluded from query
      },
      adr: parseFloat(adr.toFixed(2)),
      revpar: parseFloat(revpar.toFixed(2)),
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      totalBookings,
      websiteBookings
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

    const apiStartDate = new Date(startDate).toISOString().split('T')[0];
    const apiEndDate = new Date(endDate).toISOString().split('T')[0];

    console.log(`Fetching dashboard data from ${apiStartDate} to ${apiEndDate}`);

    // Fetch Cloudbeds and GA data in parallel
    const [cloudbedsData, gaData] = await Promise.all([
      fetchCloudbedsData(apiStartDate, apiEndDate),
      fetchGoogleAnalyticsData(apiStartDate, apiEndDate)
    ]);

    // Calculate conversion rate from real GA + Cloudbeds data
    const conversion = gaData && gaData.sessions > 0
      ? ((cloudbedsData.totalBookings / gaData.sessions) * 100).toFixed(2)
      : 0;

    // Format the data for the dashboard
    const dashboardData = {
      websiteTraffic: {
        sessions: gaData?.sessions ?? 0,
        pageViews: gaData?.pageViews ?? 0,
        avgEngagementTime: gaData?.avgEngagementTime ?? '0m 0s',
        newUsers: gaData?.newUsers ?? 0,
        activeUsers: gaData?.activeUsers ?? 0,
        bounceRate: gaData?.bounceRate ?? 0,
        adr: cloudbedsData.adr,
        revpar: cloudbedsData.revpar,
        conversion: parseFloat(conversion)
      },
      propertyData: cloudbedsData.propertyData,
      bookingSourceData: cloudbedsData.bookingSourceData,
      countryData: cloudbedsData.countryData,
      hourlyData: cloudbedsData.hourlyData,
      dailyData: cloudbedsData.dailyData,
      platformData: cloudbedsData.platformData,
      operationalData: cloudbedsData.operationalData,
      gaTopPages: gaData?.topPages ?? [],
      gaDailyTrend: gaData?.dailyTrend ?? []
    };

    console.log(`Successfully fetched data: ${cloudbedsData.totalBookings} bookings, $${cloudbedsData.totalRevenue} revenue, ${gaData?.sessions ?? 0} GA sessions`);
    res.json(dashboardData);
  } catch (error) {
    console.error('Error in /api/dashboard-data:', error);
    res.status(500).json({
      error: 'Failed to fetch dashboard data',
      details: error.message
    });
  }
});

// Check API connection status
app.get('/api/connection-status', async (req, res) => {
  const status = {
    googleAnalytics: { connected: false, lastSync: null },
    cloudbeds: { connected: false, lastSync: null, properties: [] }
  };

  // Test GA connection
  try {
    const [response] = await analyticsDataClient.runReport({
      property: `properties/${GA_PROPERTY_ID}`,
      dateRanges: [{ startDate: 'yesterday', endDate: 'today' }],
      metrics: [{ name: 'sessions' }]
    });
    status.googleAnalytics.connected = true;
    status.googleAnalytics.lastSync = new Date().toISOString();
  } catch (error) {
    console.error('GA connection test failed:', error.message);
  }

  // Test Cloudbeds connection for each property
  let connectedCount = 0;
  const propertyStatuses = [];

  for (const property of properties) {
    try {
      const headers = {
        'Authorization': `Bearer ${property.apiKey}`,
        'Content-Type': 'application/json'
      };

      await axios.get(`${CLOUDBEDS_API_URL}/getReservations`, {
        headers,
        params: {
          propertyID: property.id,
          pageSize: 1
        }
      });

      propertyStatuses.push({
        name: property.name,
        id: property.id,
        connected: true
      });
      connectedCount++;
    } catch (error) {
      console.error(`Connection failed for ${property.name}:`, error.response?.data || error.message);
      propertyStatuses.push({
        name: property.name,
        id: property.id,
        connected: false,
        error: error.response?.data?.message || error.message
      });
    }
  }

  status.cloudbeds.connected = connectedCount > 0;
  status.cloudbeds.lastSync = connectedCount > 0 ? new Date().toISOString() : null;
  status.cloudbeds.properties = propertyStatuses;
  status.cloudbeds.connectedProperties = `${connectedCount}/${properties.length}`;

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
