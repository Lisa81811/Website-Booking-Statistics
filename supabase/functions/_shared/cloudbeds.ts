// Cloudbeds API helper for Deno Edge Functions

const CLOUDBEDS_API_URL = "https://api.cloudbeds.com/api/v1.3";

interface Property {
  id: string;
  name: string;
  apiKey: string;
  capacity: number;
}

// Hard-coded room capacity per property
const PROPERTY_CAPACITY: Record<string, number> = {
  "311271": 176, // Azzurro Pod Hotel Darling Harbour
  "311267": 48,  // Azzurro Pod Hotel Central Sydney
  "311134": 69,  // Azzurro Boutique Hotel Surry Hills
  "311272": 107, // Azzurro Pod Hotel Potts Point
  "311268": 14,  // The Pyrmont Budget Hotel
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function loadProperties(): Property[] {
  const properties: Property[] = [];
  for (let i = 1; i <= 5; i++) {
    const id = Deno.env.get(`PROPERTY_${i}_ID`);
    const name = Deno.env.get(`PROPERTY_${i}_NAME`);
    const apiKey = Deno.env.get(`PROPERTY_${i}_API_KEY`);
    if (id && name && apiKey) {
      properties.push({ id, name, apiKey, capacity: PROPERTY_CAPACITY[id] || 0 });
    }
  }
  return properties;
}

async function fetchAllReservations(
  property: Property,
  startDate: string,
  endDate: string
): Promise<unknown[]> {
  let allReservations: unknown[] = [];
  let pageNumber = 1;
  let hasMorePages = true;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${property.apiKey}`,
    "X-PROPERTY-ID": property.id,
    "Content-Type": "application/json",
  };

  while (hasMorePages) {
    const params = new URLSearchParams({
      propertyID: property.id,
      resultsFrom: `${startDate} 00:00:00`,
      resultsTo: `${endDate} 23:59:59`,
      excludeStatuses: "canceled",
      pageNumber: String(pageNumber),
      pageSize: "100",
    });

    const response = await fetch(
      `${CLOUDBEDS_API_URL}/getReservationsWithRateDetails?${params}`,
      { headers }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Cloudbeds API error for ${property.name}: ${JSON.stringify(error)}`
      );
    }

    const data = await response.json();
    const reservations = data.data || [];
    allReservations = allReservations.concat(reservations);

    const totalCount = data.total || 0;
    hasMorePages = allReservations.length < totalCount;
    pageNumber++;
  }

  return allReservations;
}

// Fetch all unassigned rooms with pagination (matches Python fetch_all_unassigned_rooms)
async function fetchUnassignedRooms(property: Property): Promise<{
  rooms: { roomName: string; roomTypeName: string; roomID: string; roomBlocked: boolean }[];
  totalUnassigned: number;
}> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${property.apiKey}`,
    "Content-Type": "application/json",
  };

  // deno-lint-ignore no-explicit-any
  let allRooms: any[] = [];
  let totalUnassigned = 0;
  let page = 1;

  while (true) {
    const params = new URLSearchParams({
      propertyID: property.id,
      pageNumber: String(page),
    });

    const resp = await fetch(
      `${CLOUDBEDS_API_URL}/getRoomsUnassigned?${params}`,
      { headers }
    );

    if (!resp.ok) break;
    const json = await resp.json();
    const dataList = json.data || [];
    if (!dataList.length || json.count === 0) break;

    if (page === 1) totalUnassigned = json.total || 0;

    const rooms = dataList[0]?.rooms || [];
    allRooms = allRooms.concat(rooms);
    page++;

    if (allRooms.length >= totalUnassigned) break;
    await delay(150);
  }

  return { rooms: allRooms, totalUnassigned };
}

// Fetch today's operational snapshot from getDashboard
async function fetchDashboardToday(property: Property): Promise<{
  checkIns: number;
  checkOuts: number;
  inHouse: number;
  stayOvers: number;
  cancellations: number;
}> {
  try {
    const today = new Date().toISOString().split("T")[0];
    const headers: Record<string, string> = {
      Authorization: `Bearer ${property.apiKey}`,
      "X-PROPERTY-ID": property.id,
      "Content-Type": "application/json",
    };

    const params = new URLSearchParams({
      propertyID: property.id,
      date: today,
    });

    const response = await fetch(
      `${CLOUDBEDS_API_URL}/getDashboard?${params}`,
      { headers }
    );

    if (!response.ok) return { checkIns: 0, checkOuts: 0, inHouse: 0, stayOvers: 0, cancellations: 0 };

    const data = await response.json();
    const d = data.data || {};

    return {
      checkIns: parseInt(d.arrivalsConfirmed || 0),
      checkOuts: parseInt(d.departuresConfirmed || 0),
      inHouse: parseInt(d.inHouse || 0),
      stayOvers: parseInt(d.stayovers || 0),
      cancellations: parseInt(d.cancellations || 0),
    };
  } catch {
    return { checkIns: 0, checkOuts: 0, inHouse: 0, stayOvers: 0, cancellations: 0 };
  }
}

async function fetchPropertyData(
  property: Property,
  startDate: string,
  endDate: string
) {
  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${property.apiKey}`,
      "X-PROPERTY-ID": property.id,
      "Content-Type": "application/json",
    };

    // Fetch reservations, no-shows, dashboard, and unassigned rooms in parallel
    const [reservations, noShowResponse, dashboard, unassigned] = await Promise.all([
      fetchAllReservations(property, startDate, endDate),
      fetch(
        `${CLOUDBEDS_API_URL}/getReservations?${new URLSearchParams({
          propertyID: property.id,
          status: "no_show",
          checkInFrom: startDate,
          checkInTo: endDate,
          pageSize: "100",
        })}`,
        { headers }
      ),
      fetchDashboardToday(property),
      fetchUnassignedRooms(property),
    ]);

    let noShowCount = 0;
    if (noShowResponse.ok) {
      const noShowData = await noShowResponse.json();
      noShowCount = noShowData.count || 0;
    }

    // Calculate beds left (matching Python logic)
    const seenBlockedIds = new Set<string>();
    let blockedCount = 0;
    let testRooms = 0;
    let privateRoomsUnassigned = 0;
    // deno-lint-ignore no-explicit-any
    const availableRooms: { roomName: string; roomTypeName: string }[] = [];

    // deno-lint-ignore no-explicit-any
    for (const r of unassigned.rooms as any[]) {
      const rName = (r.roomName || "").toUpperCase();
      const rtName = (r.roomTypeName || "Other");
      const rtUpper = rtName.toUpperCase();
      const rId = String(r.roomID || "");
      const isBlocked = r.roomBlocked === true;

      // Exclude test rooms (not blocked)
      if ((rName.includes("TEST") || rtUpper.includes("TEST")) && !isBlocked) {
        testRooms++;
        continue;
      }

      // Exclude private rooms (not blocked)
      if (rtUpper.includes("PRIVATE") && !isBlocked) {
        privateRoomsUnassigned++;
        continue;
      }

      // Count unique blocked rooms
      if (isBlocked && !seenBlockedIds.has(rId)) {
        blockedCount++;
        seenBlockedIds.add(rId);
        continue;
      }

      if (!isBlocked) {
        availableRooms.push({ roomName: r.roomName, roomTypeName: rtName });
      }
    }

    const bedsLeft = unassigned.totalUnassigned - blockedCount - testRooms - privateRoomsUnassigned;
    const capacity = property.capacity;
    const occupancy = capacity > 0 ? ((capacity - bedsLeft) / capacity) * 100 : 0;

    return {
      propertyId: property.id,
      propertyName: property.name,
      capacity,
      reservations,
      noShowCount,
      dashboard,
      bedsLeft: Math.max(0, bedsLeft),
      occupancy: parseFloat(occupancy.toFixed(2)),
      availableRooms,
    };
  } catch (error) {
    console.error(
      `Error fetching data for ${property.name}:`,
      (error as Error).message
    );
    return {
      propertyId: property.id,
      propertyName: property.name,
      capacity: property.capacity,
      reservations: [] as unknown[],
      noShowCount: 0,
      dashboard: { checkIns: 0, checkOuts: 0, inHouse: 0, stayOvers: 0, cancellations: 0 },
      bedsLeft: 0,
      occupancy: 0,
      availableRooms: [] as { roomName: string; roomTypeName: string }[],
    };
  }
}

export async function fetchCloudbedsData(
  properties: Property[],
  startDate: string,
  endDate: string
) {
  // Fetch properties in batches of 2 to balance speed vs Cloudbeds rate limits (~10 req/sec)
  const allPropertyData = [];
  for (let i = 0; i < properties.length; i += 2) {
    const batch = properties.slice(i, i + 2);
    const results = await Promise.all(
      batch.map((property) => fetchPropertyData(property, startDate, endDate))
    );
    allPropertyData.push(...results);
  }

  // Aggregation
  const propertyStats: Record<
    string,
    {
      name: string;
      totalBookings: number;
      privateRooms: number;
      revenue: number;
      capacity: number;
      bedsLeft: number;
      occupancy: number;
      availableRooms: { roomName: string; roomTypeName: string }[];
    }
  > = {};
  const countryStats: Record<string, { bookings: number; revenue: number }> =
    {};
  const platformStats: Record<string, { bookings: number; revenue: number }> =
    {};
  const hourlyBookings = Array(24).fill(0);
  const dailyBookings: Record<string, number> = {
    Mon: 0,
    Tue: 0,
    Wed: 0,
    Thu: 0,
    Fri: 0,
    Sat: 0,
    Sun: 0,
  };

  let totalBookings = 0;
  let totalRevenue = 0;
  let websiteRevenue = 0;
  let websiteBookings = 0;
  let privateRooms = 0;
  let noShows = 0;
  let checkIns = 0;
  let checkOuts = 0;
  let inHouse = 0;
  let stayOvers = 0;
  let cancellations = 0;

  let totalBedsLeft = 0;
  let totalCapacity = 0;

  allPropertyData.forEach((propData) => {
    const { reservations, noShowCount, propertyId, propertyName, dashboard,
            bedsLeft, occupancy: propOccupancy, capacity: propCapacity, availableRooms } = propData;

    // Aggregate today's operational snapshot
    checkIns += dashboard.checkIns;
    checkOuts += dashboard.checkOuts;
    inHouse += dashboard.inHouse;
    stayOvers += dashboard.stayOvers;
    cancellations += dashboard.cancellations;

    totalBedsLeft += bedsLeft;
    totalCapacity += propCapacity;

    if (!propertyStats[propertyId]) {
      propertyStats[propertyId] = {
        name: propertyName,
        totalBookings: 0,
        privateRooms: 0,
        revenue: 0,
        capacity: propCapacity,
        bedsLeft,
        occupancy: propOccupancy,
        availableRooms,
      };
    }

    noShows += noShowCount;

    // deno-lint-ignore no-explicit-any
    reservations.forEach((reservation: any) => {
      const source = reservation.sourceName || "Unknown";
      const revenue = parseFloat(reservation.total || 0);
      const guestCountry = reservation.guestCountry || "Unknown";
      const status = reservation.status || "";

      if (status.toLowerCase() !== "no_show") {
        totalBookings++;
        propertyStats[propertyId].totalBookings++;
      }

      totalRevenue += revenue;
      propertyStats[propertyId].revenue += revenue;

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
      if (
        source.toLowerCase().includes("website") ||
        source.toLowerCase().includes("booking engine")
      ) {
        websiteBookings++;
        websiteRevenue += revenue;
      }

      // Private rooms
      const rooms = reservation.rooms || [];
      // deno-lint-ignore no-explicit-any
      rooms.forEach((room: any) => {
        const roomType = (room.roomTypeName || "").toLowerCase();
        if (
          roomType.includes("private") ||
          roomType.includes("single") ||
          roomType.includes("double") ||
          roomType.includes("queen") ||
          roomType.includes("king")
        ) {
          privateRooms++;
          propertyStats[propertyId].privateRooms++;
        }
      });

      // Hourly and daily distribution
      const dateCreated = reservation.dateCreatedUTC || reservation.dateCreated;
      if (dateCreated) {
        const date = new Date(dateCreated);
        const hour = date.getHours();
        const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
          date.getDay()
        ];
        hourlyBookings[hour]++;
        dailyBookings[day]++;
      }
    });
  });

  const adr = totalBookings > 0 ? totalRevenue / totalBookings : 0;
  const overallOccupancy = totalCapacity > 0
    ? ((totalCapacity - totalBedsLeft) / totalCapacity) * 100
    : 0;
  const revpar = adr * (overallOccupancy / 100);

  return {
    propertyData: Object.entries(propertyStats).map(([, stats]) => ({
      name: stats.name,
      totalBookings: stats.totalBookings,
      privateRooms: stats.privateRooms,
      capacity: stats.capacity,
      occupancy: Math.round(stats.occupancy),
      bedsRemaining: stats.bedsLeft,
      availableRooms: stats.availableRooms,
    })),
    overallOccupancy: parseFloat(overallOccupancy.toFixed(2)),
    totalBedsLeft,
    totalCapacity,
    bookingSourceData: [
      {
        name: "Website/Booking Engine",
        amount: websiteRevenue,
        count: websiteBookings,
      },
      {
        name: "Other Channels",
        amount: totalRevenue - websiteRevenue,
        count: totalBookings - websiteBookings,
      },
    ],
    platformData: Object.entries(platformStats)
      .map(([name, data]) => ({
        name,
        value: data.bookings,
        revenue: data.revenue,
        adr: data.bookings > 0 ? parseFloat((data.revenue / data.bookings).toFixed(2)) : 0,
        color: "#2d5a3d",
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10),
    countryData: Object.entries(countryStats)
      .map(([country, stats]) => ({
        country,
        bookings: stats.bookings,
        revenue: Math.round(stats.revenue),
        adr: stats.bookings > 0 ? parseFloat((stats.revenue / stats.bookings).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.bookings - a.bookings)
      .slice(0, 10),
    hourlyData: hourlyBookings.map((bookings: number, hour: number) => ({
      hour: `${hour.toString().padStart(2, "0")}:00`,
      bookings,
    })),
    dailyData: Object.entries(dailyBookings).map(([day, bookings]) => ({
      day,
      bookings,
    })),
    operationalData: {
      checkIns,
      checkOuts,
      inHouse,
      stayOver: stayOvers,
      noShows,
      cancellations,
    },
    adr: parseFloat(adr.toFixed(2)),
    revpar: parseFloat(revpar.toFixed(2)),
    totalRevenue: parseFloat(totalRevenue.toFixed(2)),
    totalBookings,
    websiteBookings,
  };
}
