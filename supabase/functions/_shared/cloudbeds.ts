// Cloudbeds API helper for Deno Edge Functions

const CLOUDBEDS_API_URL = "https://api.cloudbeds.com/api/v1.3";

interface Property {
  id: string;
  name: string;
  apiKey: string;
}

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
      properties.push({ id, name, apiKey });
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

    const totalCount = data.count || 0;
    hasMorePages = allReservations.length < totalCount;
    pageNumber++;

    if (hasMorePages) {
      await delay(150);
    }
  }

  return allReservations;
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

    // Fetch reservations with pagination
    const reservations = await fetchAllReservations(
      property,
      startDate,
      endDate
    );

    // Fetch no-shows
    const noShowParams = new URLSearchParams({
      propertyID: property.id,
      status: "no_show",
      checkInFrom: startDate,
      checkInTo: endDate,
      pageSize: "100",
    });

    const noShowResponse = await fetch(
      `${CLOUDBEDS_API_URL}/getReservations?${noShowParams}`,
      { headers }
    );

    let noShowCount = 0;
    if (noShowResponse.ok) {
      const noShowData = await noShowResponse.json();
      noShowCount = noShowData.count || 0;
    }

    return {
      propertyId: property.id,
      propertyName: property.name,
      reservations,
      noShowCount,
    };
  } catch (error) {
    console.error(
      `Error fetching data for ${property.name}:`,
      (error as Error).message
    );
    return {
      propertyId: property.id,
      propertyName: property.name,
      reservations: [] as unknown[],
      noShowCount: 0,
    };
  }
}

export async function fetchCloudbedsData(
  properties: Property[],
  startDate: string,
  endDate: string
) {
  // Fetch all properties in parallel
  const allPropertyData = await Promise.all(
    properties.map((property) =>
      fetchPropertyData(property, startDate, endDate)
    )
  );

  // Aggregation
  const propertyStats: Record<
    string,
    {
      name: string;
      totalBookings: number;
      privateRooms: number;
      revenue: number;
      checkIns: number;
      checkOuts: number;
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

  const rangeStart = new Date(startDate);
  const rangeEnd = new Date(endDate);

  allPropertyData.forEach((propData) => {
    const { reservations, noShowCount, propertyId, propertyName } = propData;

    if (!propertyStats[propertyId]) {
      propertyStats[propertyId] = {
        name: propertyName,
        totalBookings: 0,
        privateRooms: 0,
        revenue: 0,
        checkIns: 0,
        checkOuts: 0,
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

      // Check-ins and check-outs
      const checkIn = reservation.startDate
        ? new Date(reservation.startDate)
        : null;
      const checkOut = reservation.endDate
        ? new Date(reservation.endDate)
        : null;

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
  const estimatedOccupancy = 75;
  const revpar = adr * (estimatedOccupancy / 100);

  return {
    propertyData: Object.entries(propertyStats).map(([, stats]) => ({
      name: stats.name,
      totalBookings: stats.totalBookings,
      privateRooms: stats.privateRooms,
      occupancy:
        Math.round((stats.totalBookings / totalBookings) * 100) || 0,
      bedsRemaining: 0,
    })),
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
        color: "#2d5a3d",
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10),
    countryData: Object.entries(countryStats)
      .map(([country, stats]) => ({
        country,
        bookings: stats.bookings,
        revenue: Math.round(stats.revenue),
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
      inHouse: 0,
      stayOver: 0,
      noShows,
      cancellations: 0,
    },
    adr: parseFloat(adr.toFixed(2)),
    revpar: parseFloat(revpar.toFixed(2)),
    totalRevenue: parseFloat(totalRevenue.toFixed(2)),
    totalBookings,
    websiteBookings,
  };
}
