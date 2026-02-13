import "@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "../_shared/cors.ts";
import {
  getGoogleAccessToken,
  runGAReport,
} from "../_shared/google-auth.ts";
import { loadProperties, fetchCloudbedsData } from "../_shared/cloudbeds.ts";

const GA_PROPERTY_ID = Deno.env.get("GA_PROPERTY_ID") || "460526176";

async function fetchGoogleAnalyticsData(
  startDate: string,
  endDate: string
) {
  try {
    const serviceAccountJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT");
    if (!serviceAccountJson) {
      console.error("GOOGLE_SERVICE_ACCOUNT secret not set");
      return null;
    }

    const serviceAccount = JSON.parse(serviceAccountJson);
    const accessToken = await getGoogleAccessToken(serviceAccount);

    // Fetch summary metrics
    // deno-lint-ignore no-explicit-any
    const summaryReport: any = await runGAReport(accessToken, GA_PROPERTY_ID, {
      dateRanges: [{ startDate, endDate }],
      metrics: [
        { name: "sessions" },
        { name: "screenPageViews" },
        { name: "newUsers" },
        { name: "averageSessionDuration" },
        { name: "activeUsers" },
        { name: "engagedSessions" },
        { name: "bounceRate" },
        { name: "conversions" },
      ],
    });

    const row = summaryReport.rows?.[0];
    if (!row) return null;

    const sessions = parseInt(row.metricValues[0].value) || 0;
    const pageViews = parseInt(row.metricValues[1].value) || 0;
    const newUsers = parseInt(row.metricValues[2].value) || 0;
    const avgSec = parseFloat(row.metricValues[3].value) || 0;
    const activeUsers = parseInt(row.metricValues[4].value) || 0;
    const engagedSessions = parseInt(row.metricValues[5].value) || 0;
    const bounceRate = parseFloat(row.metricValues[6].value) || 0;
    const conversions = parseInt(row.metricValues[7].value) || 0;

    const avgEngagementTime = `${Math.floor(avgSec / 60)}m ${Math.round(avgSec % 60)}s`;

    // Fetch top pages
    // deno-lint-ignore no-explicit-any
    const pageReport: any = await runGAReport(accessToken, GA_PROPERTY_ID, {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "pagePath" }],
      metrics: [{ name: "screenPageViews" }, { name: "sessions" }],
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: 10,
    });

    // deno-lint-ignore no-explicit-any
    const topPages = (pageReport.rows || []).map((r: any) => ({
      path: r.dimensionValues[0].value,
      views: parseInt(r.metricValues[0].value),
      sessions: parseInt(r.metricValues[1].value),
    }));

    // Fetch daily trend
    // deno-lint-ignore no-explicit-any
    const dailyReport: any = await runGAReport(accessToken, GA_PROPERTY_ID, {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "date" }],
      metrics: [
        { name: "sessions" },
        { name: "screenPageViews" },
        { name: "newUsers" },
      ],
      orderBys: [{ dimension: { dimensionName: "date" }, desc: false }],
    });

    // deno-lint-ignore no-explicit-any
    const dailyTrend = (dailyReport.rows || []).map((r: any) => ({
      date: r.dimensionValues[0].value,
      sessions: parseInt(r.metricValues[0].value),
      pageViews: parseInt(r.metricValues[1].value),
      newUsers: parseInt(r.metricValues[2].value),
    }));

    return {
      sessions,
      pageViews,
      newUsers,
      activeUsers,
      avgEngagementTime,
      engagedSessions,
      bounceRate: parseFloat((bounceRate * 100).toFixed(1)),
      conversions,
      topPages,
      dailyTrend,
    };
  } catch (error) {
    console.error("Error fetching GA data:", (error as Error).message);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { startDate, endDate } = await req.json();
    const apiStartDate = new Date(startDate).toISOString().split("T")[0];
    const apiEndDate = new Date(endDate).toISOString().split("T")[0];

    const properties = loadProperties();

    // Fetch Cloudbeds and GA data in parallel
    const [cloudbedsData, gaData] = await Promise.all([
      fetchCloudbedsData(properties, apiStartDate, apiEndDate),
      fetchGoogleAnalyticsData(apiStartDate, apiEndDate),
    ]);

    const conversion =
      gaData && gaData.sessions > 0
        ? ((cloudbedsData.totalBookings / gaData.sessions) * 100).toFixed(2)
        : "0";

    const dashboardData = {
      websiteTraffic: {
        sessions: gaData?.sessions ?? 0,
        pageViews: gaData?.pageViews ?? 0,
        avgEngagementTime: gaData?.avgEngagementTime ?? "0m 0s",
        newUsers: gaData?.newUsers ?? 0,
        activeUsers: gaData?.activeUsers ?? 0,
        bounceRate: gaData?.bounceRate ?? 0,
        adr: cloudbedsData.adr,
        revpar: cloudbedsData.revpar,
        conversion: parseFloat(conversion),
      },
      propertyData: cloudbedsData.propertyData,
      bookingSourceData: cloudbedsData.bookingSourceData,
      countryData: cloudbedsData.countryData,
      hourlyData: cloudbedsData.hourlyData,
      dailyData: cloudbedsData.dailyData,
      platformData: cloudbedsData.platformData,
      operationalData: cloudbedsData.operationalData,
      overallOccupancy: cloudbedsData.overallOccupancy,
      totalBedsLeft: cloudbedsData.totalBedsLeft,
      totalCapacity: cloudbedsData.totalCapacity,
      gaTopPages: gaData?.topPages ?? [],
      gaDailyTrend: gaData?.dailyTrend ?? [],
    };

    return new Response(JSON.stringify(dashboardData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", (error as Error).message);
    return new Response(
      JSON.stringify({
        error: "Failed to fetch dashboard data",
        details: (error as Error).message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
