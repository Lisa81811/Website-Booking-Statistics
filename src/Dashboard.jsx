import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const SUPABASE_URL = 'https://mayqryqrwyfzbjxwxpte.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1heXFyeXFyd3lmemJqeHd4cHRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NzU0NjMsImV4cCI6MjA4NjQ1MTQ2M30.IEK-z3htbl2tz42JjBIe62Kl4aHQMK14nRvKzzve9G4';

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setHours(0, 0, 0, 0)),
    end: new Date(),
    label: 'Today'
  });
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiStatus, setApiStatus] = useState({
    googleAnalytics: { connected: false, lastSync: null },
    cloudbeds: { connected: false, lastSync: null }
  });
  const datePickerRef = useRef(null);
  const menuRef = useRef(null);

  const [dashboardData, setDashboardData] = useState({
    websiteTraffic: {
      sessions: 0,
      pageViews: 0,
      avgEngagementTime: '0m 0s',
      newUsers: 0,
      activeUsers: 0,
      bounceRate: 0,
      adr: 0,
      revpar: 0,
      conversion: 0
    },
    propertyData: [],
    bookingSourceData: [],
    countryData: [],
    hourlyData: [],
    dailyData: [],
    platformData: [],
    operationalData: {
      checkIns: 0, checkOuts: 0, inHouse: 0, stayOver: 0, noShows: 0, cancellations: 0
    },
    gaTopPages: [],
    gaDailyTrend: []
  });

  const COLORS = ['#2d5a3d', '#5b8e7d', '#97BC62', '#c4a35a', '#8b7e74', '#9b9b9b'];

  // Define fetch functions before useEffect
  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/dashboard-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY
        },
        body: JSON.stringify({
          startDate: dateRange.start.toISOString(),
          endDate: dateRange.end.toISOString()
        })
      });

      if (response.ok) {
        const data = await response.json();
        setDashboardData(data);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  const checkApiConnections = useCallback(async () => {
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/connection-status`, {
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY
        }
      });
      if (response.ok) {
        const status = await response.json();
        setApiStatus(status);
      }
    } catch (error) {
      console.error('Error checking API connections:', error);
    }
  }, []);

  // Fetch data when date range changes
  useEffect(() => {
    fetchDashboardData();
    checkApiConnections();
  }, [fetchDashboardData, checkApiConnections]);

  // Close date picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target)) {
        setDatePickerOpen(false);
      }
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    if (datePickerOpen || menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [datePickerOpen, menuOpen]);

  const exportToCSV = () => {
    const csvData = [];
    
    // Header
    csvData.push(['Website Booking Analytics Report']);
    csvData.push([`Date Range: ${formatDateRange()}`]);
    csvData.push([]);
    
    // Website Traffic
    csvData.push(['Website Traffic']);
    csvData.push(['Metric', 'Value']);
    csvData.push(['Sessions', dashboardData.websiteTraffic.sessions]);
    csvData.push(['Page Views', dashboardData.websiteTraffic.pageViews]);
    csvData.push(['Avg Engagement Time', dashboardData.websiteTraffic.avgEngagementTime]);
    csvData.push(['New Users', dashboardData.websiteTraffic.newUsers]);
    csvData.push(['ADR', `$${dashboardData.websiteTraffic.adr}`]);
    csvData.push(['RevPAR', `$${dashboardData.websiteTraffic.revpar}`]);
    csvData.push(['Conversion', `${dashboardData.websiteTraffic.conversion}%`]);
    csvData.push([]);
    
    // Property Performance
    csvData.push(['Property Performance']);
    csvData.push(['Property', 'Total Bookings', 'Private Rooms', 'Occupancy %', 'Beds Remaining']);
    dashboardData.propertyData.forEach(prop => {
      csvData.push([prop.name, prop.totalBookings, prop.privateRooms, prop.occupancy, prop.bedsRemaining]);
    });
    csvData.push([]);
    
    // Operational Metrics
    csvData.push(['Operational Metrics']);
    csvData.push(['Metric', 'Value']);
    csvData.push(['Check-ins', dashboardData.operationalData.checkIns]);
    csvData.push(['Check-outs', dashboardData.operationalData.checkOuts]);
    csvData.push(['In-house', dashboardData.operationalData.inHouse]);
    csvData.push(['Stay Over', dashboardData.operationalData.stayOver]);
    csvData.push(['No Shows', dashboardData.operationalData.noShows]);
    csvData.push(['Cancellations', dashboardData.operationalData.cancellations]);
    
    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dashboard-data-${dateRange.start.toISOString().split('T')[0]}-to-${dateRange.end.toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const exportToPDF = async () => {
    try {
      const response = await fetch('/api/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: dashboardData,
          dateRange: {
            start: dateRange.start.toISOString(),
            end: dateRange.end.toISOString(),
            label: dateRange.label
          }
        })
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dashboard-report-${dateRange.start.toISOString().split('T')[0]}-to-${dateRange.end.toISOString().split('T')[0]}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error exporting PDF:', error);
    }
  };

  const formatDateRange = () => {
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    return `${dateRange.label}: ${dateRange.start.toLocaleDateString('en-US', options)} - ${dateRange.end.toLocaleDateString('en-US', options)}`;
  };

  const handlePresetSelection = (preset) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    let start, end, label;
    
    switch(preset) {
      case 'today':
        start = new Date(today);
        end = new Date(today);
        label = 'Today';
        break;
      case 'yesterday':
        start = new Date(yesterday);
        end = new Date(yesterday);
        label = 'Yesterday';
        break;
      case 'last7':
        start = new Date(today);
        start.setDate(start.getDate() - 7);
        end = new Date(today);
        label = 'Last 7 days';
        break;
      case 'last14':
        start = new Date(today);
        start.setDate(start.getDate() - 14);
        end = new Date(today);
        label = 'Last 14 days';
        break;
      case 'last28':
        start = new Date(today);
        start.setDate(start.getDate() - 28);
        end = new Date(today);
        label = 'Last 28 days';
        break;
      case 'last30':
        start = new Date(today);
        start.setDate(start.getDate() - 30);
        end = new Date(today);
        label = 'Last 30 days';
        break;
      case 'thisweek':
        start = new Date(today);
        const dayOfWeek = start.getDay();
        const diff = start.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        start.setDate(diff);
        end = new Date(today);
        label = 'This week';
        break;
      case 'lastweek':
        const lastWeekEnd = new Date(today);
        lastWeekEnd.setDate(lastWeekEnd.getDate() - lastWeekEnd.getDay());
        const lastWeekStart = new Date(lastWeekEnd);
        lastWeekStart.setDate(lastWeekStart.getDate() - 6);
        start = lastWeekStart;
        end = lastWeekEnd;
        label = 'Last week';
        break;
      case 'thismonth':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today);
        label = 'This month';
        break;
      case 'lastmonth':
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        end = new Date(today.getFullYear(), today.getMonth(), 0);
        label = 'Last month';
        break;
      default:
        start = new Date(today);
        start.setDate(start.getDate() - 28);
        end = new Date(today);
        label = 'Last 28 days';
    }
    
    setCustomStartDate(start.toISOString().split('T')[0]);
    setCustomEndDate(end.toISOString().split('T')[0]);
  };

  const handleCustomDateUpdate = () => {
    if (customStartDate && customEndDate) {
      setDateRange({
        start: new Date(customStartDate),
        end: new Date(customEndDate),
        label: 'Custom range'
      });
      setDatePickerOpen(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#fdfcfb',
      fontFamily: '"DM Sans", -apple-system, BlinkMacSystemFont, sans-serif',
      color: '#1a1a1a',
      padding: '0',
      WebkitFontSmoothing: 'antialiased'
    }}>
      {/* Header */}
      <header style={{
        background: '#fff',
        borderBottom: '1px solid #e8e7e5',
        padding: '2rem 3rem',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{
              margin: 0,
              fontSize: '2.5rem',
              fontWeight: '300',
              fontFamily: '"Crimson Pro", serif',
              letterSpacing: '-0.02em',
              color: '#1a1a1a'
            }}>Website Booking Analytics</h1>
            <p style={{ margin: '0.5rem 0 0 0', color: '#6b6b6b', fontSize: '0.95rem' }}>
              Real-time insights across all properties
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
            {/* Hamburger Menu */}
            <div style={{ position: 'relative' }} ref={menuRef}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                style={{
                  background: '#fff',
                  border: '1px solid #e8e7e5',
                  borderRadius: '6px',
                  padding: '0.75rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#2d5a3d';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e8e7e5';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="12" x2="21" y2="12"></line>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
              </button>

              {menuOpen && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 0.5rem)',
                  right: 0,
                  zIndex: 1000,
                  background: '#fff',
                  border: '1px solid #e8e7e5',
                  borderRadius: '8px',
                  padding: '1rem',
                  minWidth: '280px',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
                  animation: 'fadeIn 0.2s ease'
                }}>
                  {/* API Connection Status */}
                  <div style={{ marginBottom: '1rem' }}>
                    <h3 style={{
                      margin: '0 0 0.75rem 0',
                      fontSize: '0.85rem',
                      fontWeight: '500',
                      color: '#6b6b6b',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>API Connections</h3>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.5rem',
                        background: '#f7f6f4',
                        borderRadius: '4px'
                      }}>
                        <span style={{ fontSize: '0.9rem', color: '#1a1a1a' }}>Google Analytics</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: apiStatus.googleAnalytics.connected ? '#2d5a3d' : '#bc4b51'
                          }}></span>
                          <span style={{ fontSize: '0.85rem', color: '#6b6b6b' }}>
                            {apiStatus.googleAnalytics.connected ? 'Connected' : 'Disconnected'}
                          </span>
                        </div>
                      </div>

                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.5rem',
                        background: '#f7f6f4',
                        borderRadius: '4px'
                      }}>
                        <span style={{ fontSize: '0.9rem', color: '#1a1a1a' }}>Cloudbeds</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: apiStatus.cloudbeds.connected ? '#2d5a3d' : '#bc4b51'
                          }}></span>
                          <span style={{ fontSize: '0.85rem', color: '#6b6b6b' }}>
                            {apiStatus.cloudbeds.connected ? 'Connected' : 'Disconnected'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Export Options */}
                  <div style={{ borderTop: '1px solid #e8e7e5', paddingTop: '1rem' }}>
                    <h3 style={{
                      margin: '0 0 0.75rem 0',
                      fontSize: '0.85rem',
                      fontWeight: '500',
                      color: '#6b6b6b',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>Export Data</h3>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <button
                        onClick={exportToCSV}
                        style={{
                          background: '#f7f6f4',
                          border: '1px solid #e8e7e5',
                          borderRadius: '6px',
                          padding: '0.75rem',
                          cursor: 'pointer',
                          fontFamily: '"DM Sans", sans-serif',
                          fontSize: '0.9rem',
                          color: '#1a1a1a',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#e8e7e5';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#f7f6f4';
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                          <polyline points="7 10 12 15 17 10"></polyline>
                          <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        Download as CSV
                      </button>

                      <button
                        onClick={exportToPDF}
                        style={{
                          background: '#f7f6f4',
                          border: '1px solid #e8e7e5',
                          borderRadius: '6px',
                          padding: '0.75rem',
                          cursor: 'pointer',
                          fontFamily: '"DM Sans", sans-serif',
                          fontSize: '0.9rem',
                          color: '#1a1a1a',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#e8e7e5';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#f7f6f4';
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                          <polyline points="14 2 14 8 20 8"></polyline>
                          <line x1="16" y1="13" x2="8" y2="13"></line>
                          <line x1="16" y1="17" x2="8" y2="17"></line>
                          <polyline points="10 9 9 9 8 9"></polyline>
                        </svg>
                        Download as PDF
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Date Range Picker */}
            <div style={{ position: 'relative' }} ref={datePickerRef}>
            {/* Collapsed Date Selector */}
            <button
              onClick={() => setDatePickerOpen(!datePickerOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1.25rem',
                background: '#fff',
                border: '1px solid #e8e7e5',
                borderRadius: '6px',
                cursor: 'pointer',
                fontFamily: '"DM Sans", sans-serif',
                fontSize: '0.9rem',
                color: '#1a1a1a',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#2d5a3d';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e8e7e5';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* Calendar Icon */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b6b6b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              <span style={{ fontWeight: '500' }}>{formatDateRange()}</span>
              <svg 
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="#6b6b6b" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                style={{
                  transform: datePickerOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease'
                }}
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>

            {/* Expanded Date Picker */}
            {datePickerOpen && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 0.5rem)',
                right: 0,
                zIndex: 1000,
                display: 'flex',
                gap: '1rem',
                background: '#fff',
                border: '1px solid #e8e7e5',
                borderRadius: '8px',
                padding: '1rem',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
                animation: 'fadeIn 0.2s ease'
              }}>
                {/* Quick Presets */}
                <div style={{
                  background: '#f7f6f4',
                  border: '1px solid #e8e7e5',
                  borderRadius: '6px',
                  padding: '0.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem',
                  minWidth: '140px'
                }}>
                  {[
                    { label: 'Today', value: 'today' },
                    { label: 'Yesterday', value: 'yesterday' },
                    { label: 'Last 7 days', value: 'last7' },
                    { label: 'Last 14 days', value: 'last14' },
                    { label: 'Last 28 days', value: 'last28' },
                    { label: 'Last 30 days', value: 'last30' },
                    { label: 'This week', value: 'thisweek' },
                    { label: 'Last week', value: 'lastweek' },
                    { label: 'This month', value: 'thismonth' },
                    { label: 'Last month', value: 'lastmonth' }
                  ].map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => handlePresetSelection(preset.value)}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: '0.5rem 1rem',
                        textAlign: 'left',
                        cursor: 'pointer',
                        borderRadius: '4px',
                        fontSize: '0.85rem',
                        color: '#1a1a1a',
                        fontFamily: '"DM Sans", sans-serif',
                        transition: 'background 0.2s ease',
                        whiteSpace: 'nowrap'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#e8e7e5';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'none';
                      }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {/* Custom Date Range */}
                <div style={{
                  background: '#fff',
                  padding: '0.5rem',
                  minWidth: '220px'
                }}>
                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={{
                      display: 'block',
                      marginBottom: '0.5rem',
                      color: '#6b6b6b',
                      fontSize: '0.75rem',
                      fontWeight: '500',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      From
                    </label>
                    <input
                      type="date"
                      value={customStartDate || dateRange.start.toISOString().split('T')[0]}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.6rem 0.75rem',
                        border: '1px solid #e8e7e5',
                        borderRadius: '6px',
                        fontFamily: '"DM Sans", sans-serif',
                        fontSize: '0.85rem',
                        background: '#f7f6f4',
                        color: '#1a1a1a'
                      }}
                    />
                  </div>
                  
                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={{
                      display: 'block',
                      marginBottom: '0.5rem',
                      color: '#6b6b6b',
                      fontSize: '0.75rem',
                      fontWeight: '500',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      To
                    </label>
                    <input
                      type="date"
                      value={customEndDate || dateRange.end.toISOString().split('T')[0]}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.6rem 0.75rem',
                        border: '1px solid #e8e7e5',
                        borderRadius: '6px',
                        fontFamily: '"DM Sans", sans-serif',
                        fontSize: '0.85rem',
                        background: '#f7f6f4',
                        color: '#1a1a1a'
                      }}
                    />
                  </div>

                  <button
                    onClick={handleCustomDateUpdate}
                    style={{
                      width: '100%',
                      padding: '0.6rem',
                      background: '#2d5a3d',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: '500',
                      fontSize: '0.85rem',
                      fontFamily: '"DM Sans", sans-serif',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#234831';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#2d5a3d';
                    }}
                  >
                    Update
                  </button>
                </div>
              </div>
            )}
          </div>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: '0',
        padding: '0 3rem',
        borderBottom: '1px solid #e8e7e5',
        background: '#fff'
      }}>
        {[
          { id: 'overview', label: 'Overview & Traffic' },
          { id: 'breakdown', label: 'Booking Breakdown' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              background: 'none',
              border: 'none',
              padding: '0.75rem 1.5rem',
              cursor: 'pointer',
              fontWeight: '500',
              fontSize: '0.9rem',
              fontFamily: '"DM Sans", sans-serif',
              color: activeTab === tab.id ? '#2d5a3d' : '#6b6b6b',
              position: 'relative',
              transition: 'color 0.2s ease',
              borderBottom: activeTab === tab.id ? '2px solid #2d5a3d' : '2px solid transparent'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div style={{ padding: '3rem', maxWidth: '1400px', margin: '0 auto', position: 'relative' }}>
        {loading && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(253, 252, 251, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
            borderRadius: '8px'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '40px',
                height: '40px',
                margin: '0 auto 1rem',
                border: '3px solid #e8e7e5',
                borderTop: '3px solid #2d5a3d',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></div>
              <p style={{ color: '#6b6b6b', fontSize: '0.9rem' }}>Loading data...</p>
            </div>
          </div>
        )}
        
        {activeTab === 'overview' && (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            {/* Website Traffic Section */}
            <section style={{ marginBottom: '3rem' }}>
              <h2 style={{
                fontSize: '1.3rem',
                marginBottom: '1.5rem',
                fontFamily: '"Crimson Pro", serif',
                fontWeight: '400',
                color: '#1a1a1a'
              }}>Website Traffic</h2>
              
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1.5rem',
                marginBottom: '2rem'
              }}>
                {[
                  { label: 'Sessions', value: dashboardData.websiteTraffic.sessions.toLocaleString() },
                  { label: 'Page Views', value: dashboardData.websiteTraffic.pageViews.toLocaleString() },
                  { label: 'Avg. Engagement', value: dashboardData.websiteTraffic.avgEngagementTime },
                  { label: 'New Users', value: dashboardData.websiteTraffic.newUsers.toLocaleString() },
                  { label: 'Active Users', value: (dashboardData.websiteTraffic.activeUsers || 0).toLocaleString() },
                  { label: 'Bounce Rate', value: `${dashboardData.websiteTraffic.bounceRate || 0}%` },
                  { label: 'ADR', value: `$${dashboardData.websiteTraffic.adr}` },
                  { label: 'RevPAR', value: `$${dashboardData.websiteTraffic.revpar}` },
                  { label: 'Conversion', value: `${dashboardData.websiteTraffic.conversion}%` }
                ].map((metric, idx) => (
                  <div key={idx} style={{
                    background: '#fff',
                    border: '1px solid #e8e7e5',
                    borderRadius: '8px',
                    padding: '2rem',
                    transition: 'box-shadow 0.2s ease',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.04)';
                  }}>
                    <div style={{ 
                      fontSize: '0.85rem', 
                      color: '#6b6b6b', 
                      marginBottom: '0.75rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      fontWeight: '500'
                    }}>
                      {metric.label}
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: '600', color: '#2d5a3d' }}>
                      {metric.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Daily Site Traffic Trend */}
              {dashboardData.gaDailyTrend && dashboardData.gaDailyTrend.length > 0 && (
                <div style={{
                  background: '#fff',
                  border: '1px solid #e8e7e5',
                  borderRadius: '8px',
                  padding: '2rem',
                  marginTop: '1.5rem',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
                }}>
                  <h3 style={{
                    fontSize: '1rem',
                    fontWeight: '500',
                    color: '#1a1a1a',
                    marginBottom: '1rem'
                  }}>Daily Site Traffic</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={dashboardData.gaDailyTrend.map(d => ({
                      ...d,
                      date: `${d.date.substring(4, 6)}/${d.date.substring(6, 8)}`
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e8e7e5" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b6b6b' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#6b6b6b' }} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="sessions" stroke="#2d5a3d" strokeWidth={2} dot={false} name="Sessions" />
                      <Line type="monotone" dataKey="pageViews" stroke="#97BC62" strokeWidth={2} dot={false} name="Page Views" />
                      <Line type="monotone" dataKey="newUsers" stroke="#c4a35a" strokeWidth={2} dot={false} name="New Users" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Top Pages */}
              {dashboardData.gaTopPages && dashboardData.gaTopPages.length > 0 && (
                <div style={{
                  background: '#fff',
                  border: '1px solid #e8e7e5',
                  borderRadius: '8px',
                  padding: '2rem',
                  marginTop: '1.5rem',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
                }}>
                  <h3 style={{
                    fontSize: '1rem',
                    fontWeight: '500',
                    color: '#1a1a1a',
                    marginBottom: '1rem'
                  }}>Top Pages</h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #e8e7e5' }}>
                        <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.8rem', color: '#6b6b6b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Page Path</th>
                        <th style={{ textAlign: 'right', padding: '0.75rem', fontSize: '0.8rem', color: '#6b6b6b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Views</th>
                        <th style={{ textAlign: 'right', padding: '0.75rem', fontSize: '0.8rem', color: '#6b6b6b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sessions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardData.gaTopPages.map((page, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f0f0f0' }}>
                          <td style={{ padding: '0.75rem', fontSize: '0.9rem', color: '#2d5a3d', fontWeight: '500' }}>{page.path}</td>
                          <td style={{ textAlign: 'right', padding: '0.75rem', fontSize: '0.9rem' }}>{page.views.toLocaleString()}</td>
                          <td style={{ textAlign: 'right', padding: '0.75rem', fontSize: '0.9rem' }}>{page.sessions.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Website Booking Section */}
            <section style={{ marginBottom: '3rem' }}>
              <h2 style={{
                fontSize: '1.3rem',
                marginBottom: '1.5rem',
                fontFamily: '"Crimson Pro", serif',
                fontWeight: '400',
                color: '#1a1a1a'
              }}>Website Bookings</h2>

              {/* Booking Summary Cards */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '1.5rem',
                marginBottom: '2rem'
              }}>
                {dashboardData.bookingSourceData.map((source, idx) => (
                  <div key={idx} style={{
                    background: idx === 0 ? '#e8f0ea' : '#fff',
                    border: '1px solid #e8e7e5',
                    borderRadius: '8px',
                    padding: '2rem',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.04)';
                  }}>
                    <div style={{ 
                      fontSize: '0.85rem', 
                      color: '#6b6b6b', 
                      marginBottom: '0.75rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      fontWeight: '500'
                    }}>
                      {source.name} Bookings
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: '600', color: '#2d5a3d', marginBottom: '0.5rem' }}>
                      ${source.amount.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '1rem', color: '#6b6b6b' }}>
                      {source.count} bookings
                    </div>
                  </div>
                ))}
              </div>

              {/* Operational Metrics */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '1.5rem',
                marginBottom: '2rem'
              }}>
                {[
                  { label: 'Check-ins', value: dashboardData.operationalData.checkIns, color: '#2d5a3d' },
                  { label: 'Check-outs', value: dashboardData.operationalData.checkOuts, color: '#5b8e7d' },
                  { label: 'In-house', value: dashboardData.operationalData.inHouse, color: '#97BC62' },
                  { label: 'Stay Over', value: dashboardData.operationalData.stayOver, color: '#c4a35a' },
                  { label: 'No Shows', value: dashboardData.operationalData.noShows, color: '#bc4b51' },
                  { label: 'Cancellations', value: dashboardData.operationalData.cancellations, color: '#9b9b9b' }
                ].map((metric, idx) => (
                  <div key={idx} style={{
                    background: '#fff',
                    border: '1px solid #e8e7e5',
                    borderRadius: '8px',
                    padding: '2rem',
                    textAlign: 'center',
                    transition: 'box-shadow 0.2s ease',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.04)';
                  }}>
                    <div style={{ 
                      fontSize: '0.85rem', 
                      color: '#6b6b6b', 
                      marginBottom: '0.75rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      fontWeight: '500'
                    }}>
                      {metric.label}
                    </div>
                    <div style={{ fontSize: '2.5rem', fontWeight: '600', color: metric.color }}>
                      {metric.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Property Performance */}
              <div style={{
                background: '#fff',
                border: '1px solid #e8e7e5',
                borderRadius: '8px',
                padding: '2rem',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
              }}>
                <h3 style={{ 
                  marginTop: 0, 
                  marginBottom: '1.5rem', 
                  fontFamily: '"Crimson Pro", serif',
                  fontSize: '1.3rem',
                  fontWeight: '400',
                  color: '#1a1a1a'
                }}>
                  Property Performance
                </h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0' }}>
                    <thead>
                      <tr style={{ background: '#f7f6f4' }}>
                        <th style={{ 
                          padding: '1rem', 
                          textAlign: 'left', 
                          fontWeight: '500',
                          fontSize: '0.85rem',
                          color: '#6b6b6b',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          borderBottom: '1px solid #e8e7e5'
                        }}>
                          Property
                        </th>
                        <th style={{ 
                          padding: '1rem', 
                          textAlign: 'right',
                          fontWeight: '500',
                          fontSize: '0.85rem',
                          color: '#6b6b6b',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          borderBottom: '1px solid #e8e7e5'
                        }}>
                          Total Bookings
                        </th>
                        <th style={{ 
                          padding: '1rem', 
                          textAlign: 'right',
                          fontWeight: '500',
                          fontSize: '0.85rem',
                          color: '#6b6b6b',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          borderBottom: '1px solid #e8e7e5'
                        }}>
                          Private Rooms
                        </th>
                        <th style={{ 
                          padding: '1rem', 
                          textAlign: 'right',
                          fontWeight: '500',
                          fontSize: '0.85rem',
                          color: '#6b6b6b',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          borderBottom: '1px solid #e8e7e5'
                        }}>
                          Occupancy
                        </th>
                        <th style={{ 
                          padding: '1rem', 
                          textAlign: 'right',
                          fontWeight: '500',
                          fontSize: '0.85rem',
                          color: '#6b6b6b',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          borderBottom: '1px solid #e8e7e5'
                        }}>
                          Beds Remaining
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardData.propertyData.map((property, idx) => (
                        <tr key={idx} style={{
                          transition: 'background 0.2s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#f7f6f4'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                          <td style={{ padding: '1rem', fontWeight: '500', color: '#1a1a1a' }}>
                            {property.name}
                          </td>
                          <td style={{ padding: '1rem', textAlign: 'right', color: '#2d5a3d', fontWeight: '600' }}>
                            {property.totalBookings}
                          </td>
                          <td style={{ padding: '1rem', textAlign: 'right', color: '#6b6b6b' }}>
                            {property.privateRooms}
                          </td>
                          <td style={{ padding: '1rem', textAlign: 'right' }}>
                            <span style={{
                              background: property.occupancy >= 90 
                                ? '#e8f0ea' 
                                : property.occupancy >= 75 
                                ? '#fff4e6' 
                                : '#ffe5e5',
                              color: property.occupancy >= 90 
                                ? '#2d5a3d' 
                                : property.occupancy >= 75 
                                ? '#c4a35a' 
                                : '#bc4b51',
                              padding: '0.25rem 0.75rem',
                              borderRadius: '4px',
                              fontWeight: '500',
                              fontSize: '0.85rem'
                            }}>
                              {property.occupancy}%
                            </span>
                          </td>
                          <td style={{ padding: '1rem', textAlign: 'right', color: '#6b6b6b' }}>
                            {property.bedsRemaining}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'breakdown' && (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            {/* Booking Breakdown Section */}
            <section style={{ marginBottom: '3rem' }}>
              <h2 style={{
                fontSize: '1.3rem',
                marginBottom: '1.5rem',
                fontFamily: '"Crimson Pro", serif',
                fontWeight: '400',
                color: '#1a1a1a'
              }}>Booking Breakdown</h2>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))',
                gap: '2rem',
                marginBottom: '3rem'
              }}>
                {/* Country Breakdown */}
                <div style={{
                  background: '#fff',
                  border: '1px solid #e8e7e5',
                  borderRadius: '8px',
                  padding: '2rem',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
                }}>
                  <h3 style={{ 
                    marginTop: 0, 
                    marginBottom: '1.5rem',
                    fontFamily: '"DM Sans", sans-serif',
                    fontSize: '0.95rem',
                    fontWeight: '500',
                    color: '#1a1a1a',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    Bookings by Country
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={dashboardData.countryData}
                        dataKey="bookings"
                        nameKey="country"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={(entry) => `${entry.country}: ${entry.bookings}`}
                      >
                        {dashboardData.countryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: '#fff',
                          border: '1px solid #e8e7e5',
                          borderRadius: '6px',
                          color: '#1a1a1a',
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Hourly Bookings */}
                <div style={{
                  background: '#fff',
                  border: '1px solid #e8e7e5',
                  borderRadius: '8px',
                  padding: '2rem',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
                }}>
                  <h3 style={{ 
                    marginTop: 0, 
                    marginBottom: '1.5rem',
                    fontFamily: '"DM Sans", sans-serif',
                    fontSize: '0.95rem',
                    fontWeight: '500',
                    color: '#1a1a1a',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    Bookings by Hour
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={dashboardData.hourlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e8e7e5" />
                      <XAxis dataKey="hour" stroke="#6b6b6b" style={{ fontSize: '0.85rem' }} />
                      <YAxis stroke="#6b6b6b" style={{ fontSize: '0.85rem' }} />
                      <Tooltip
                        contentStyle={{
                          background: '#fff',
                          border: '1px solid #e8e7e5',
                          borderRadius: '6px',
                          color: '#1a1a1a',
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)'
                        }}
                      />
                      <Line type="monotone" dataKey="bookings" stroke="#2d5a3d" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Daily Bookings */}
                <div style={{
                  background: '#fff',
                  border: '1px solid #e8e7e5',
                  borderRadius: '8px',
                  padding: '2rem',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
                }}>
                  <h3 style={{ 
                    marginTop: 0, 
                    marginBottom: '1.5rem',
                    fontFamily: '"DM Sans", sans-serif',
                    fontSize: '0.95rem',
                    fontWeight: '500',
                    color: '#1a1a1a',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    Bookings by Day
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={dashboardData.dailyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e8e7e5" />
                      <XAxis dataKey="day" stroke="#6b6b6b" style={{ fontSize: '0.85rem' }} />
                      <YAxis stroke="#6b6b6b" style={{ fontSize: '0.85rem' }} />
                      <Tooltip
                        contentStyle={{
                          background: '#fff',
                          border: '1px solid #e8e7e5',
                          borderRadius: '6px',
                          color: '#1a1a1a',
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)'
                        }}
                      />
                      <Bar dataKey="bookings" fill="#2d5a3d" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Platform Distribution */}
                <div style={{
                  background: '#fff',
                  border: '1px solid #e8e7e5',
                  borderRadius: '8px',
                  padding: '2rem',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
                }}>
                  <h3 style={{ 
                    marginTop: 0, 
                    marginBottom: '1.5rem',
                    fontFamily: '"DM Sans", sans-serif',
                    fontSize: '0.95rem',
                    fontWeight: '500',
                    color: '#1a1a1a',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    Bookings by Platform
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={dashboardData.platformData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={(entry) => `${entry.name}: ${entry.value}`}
                      >
                        {dashboardData.platformData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: '#fff',
                          border: '1px solid #e8e7e5',
                          borderRadius: '6px',
                          color: '#1a1a1a',
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>

            {/* Operational Metrics Section */}
            <section>
              <h2 style={{
                fontSize: '1.3rem',
                marginBottom: '1.5rem',
                fontFamily: '"Crimson Pro", serif',
                fontWeight: '400',
                color: '#1a1a1a'
              }}>Operational Metrics</h2>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '1.5rem'
              }}>
                {[
                  { label: 'Check-ins', value: dashboardData.operationalData.checkIns, color: '#2d5a3d' },
                  { label: 'Check-outs', value: dashboardData.operationalData.checkOuts, color: '#5b8e7d' },
                  { label: 'In-house', value: dashboardData.operationalData.inHouse, color: '#97BC62' },
                  { label: 'Stay Over', value: dashboardData.operationalData.stayOver, color: '#c4a35a' },
                  { label: 'No Shows', value: dashboardData.operationalData.noShows, color: '#bc4b51' },
                  { label: 'Cancellations', value: dashboardData.operationalData.cancellations, color: '#9b9b9b' }
                ].map((metric, idx) => (
                  <div key={idx} style={{
                    background: '#fff',
                    border: '1px solid #e8e7e5',
                    borderRadius: '8px',
                    padding: '2rem',
                    textAlign: 'center',
                    transition: 'box-shadow 0.2s ease',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.04)';
                  }}>
                    <div style={{ 
                      fontSize: '0.85rem', 
                      color: '#6b6b6b', 
                      marginBottom: '0.75rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      fontWeight: '500'
                    }}>
                      {metric.label}
                    </div>
                    <div style={{ fontSize: '2.5rem', fontWeight: '600', color: metric.color }}>
                      {metric.value}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer style={{
        padding: '2rem 3rem',
        textAlign: 'center',
        color: '#9b9b9b',
        fontSize: '0.85rem',
        borderTop: '1px solid #e8e7e5',
        marginTop: '3rem',
        background: '#fff'
      }}>
        Last updated: {new Date().toLocaleString()} • Live data from Cloudbeds + Google Analytics
      </footer>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;