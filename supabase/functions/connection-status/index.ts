import "@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { getGoogleAccessToken, runGAReport } from "../_shared/google-auth.ts";
import { loadProperties } from "../_shared/cloudbeds.ts";

const GA_PROPERTY_ID = Deno.env.get("GA_PROPERTY_ID") || "460526176";
const CLOUDBEDS_API_URL = "https://api.cloudbeds.com/api/v1.3";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const status = {
    googleAnalytics: { connected: false, lastSync: null as string | null },
    cloudbeds: {
      connected: false,
      lastSync: null as string | null,
      properties: [] as { name: string; id: string; connected: boolean }[],
      connectedProperties: "0/0",
    },
  };

  // Test GA connection
  try {
    const serviceAccountJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT");
    if (serviceAccountJson) {
      const serviceAccount = JSON.parse(serviceAccountJson);
      const accessToken = await getGoogleAccessToken(serviceAccount);
      await runGAReport(accessToken, GA_PROPERTY_ID, {
        dateRanges: [{ startDate: "yesterday", endDate: "today" }],
        metrics: [{ name: "sessions" }],
      });
      status.googleAnalytics.connected = true;
      status.googleAnalytics.lastSync = new Date().toISOString();
    }
  } catch (error) {
    console.error("GA connection test failed:", (error as Error).message);
  }

  // Test Cloudbeds connections
  const properties = loadProperties();
  let connectedCount = 0;

  for (const property of properties) {
    try {
      const params = new URLSearchParams({
        propertyID: property.id,
        pageSize: "1",
      });
      const response = await fetch(
        `${CLOUDBEDS_API_URL}/getReservations?${params}`,
        {
          headers: {
            Authorization: `Bearer ${property.apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        status.cloudbeds.properties.push({
          name: property.name,
          id: property.id,
          connected: true,
        });
        connectedCount++;
      } else {
        status.cloudbeds.properties.push({
          name: property.name,
          id: property.id,
          connected: false,
        });
      }
    } catch (error) {
      console.error(
        `Connection failed for ${property.name}:`,
        (error as Error).message
      );
      status.cloudbeds.properties.push({
        name: property.name,
        id: property.id,
        connected: false,
      });
    }
  }

  status.cloudbeds.connected = connectedCount > 0;
  status.cloudbeds.lastSync =
    connectedCount > 0 ? new Date().toISOString() : null;
  status.cloudbeds.connectedProperties = `${connectedCount}/${properties.length}`;

  return new Response(JSON.stringify(status), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
