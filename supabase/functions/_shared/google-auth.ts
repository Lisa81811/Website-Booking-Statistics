// Google Service Account JWT auth for Deno Edge Functions
// Signs a JWT with the service account private key and exchanges it for an access token

function base64url(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64urlEncode(str: string): string {
  return base64url(new TextEncoder().encode(str));
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemContents = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "");

  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  return await crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

async function createSignedJWT(
  serviceAccount: { client_email: string; private_key: string },
  scope: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const header = base64urlEncode(
    JSON.stringify({ alg: "RS256", typ: "JWT" })
  );

  const payload = base64urlEncode(
    JSON.stringify({
      iss: serviceAccount.client_email,
      scope,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );

  const unsignedToken = `${header}.${payload}`;
  const key = await importPrivateKey(serviceAccount.private_key);

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsignedToken)
  );

  return `${unsignedToken}.${base64url(new Uint8Array(signature))}`;
}

// Cache the access token to avoid re-signing on every request
let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getGoogleAccessToken(
  serviceAccount: { client_email: string; private_key: string }
): Promise<string> {
  // Return cached token if still valid (with 5 min buffer)
  if (cachedToken && Date.now() < cachedToken.expiresAt - 300000) {
    return cachedToken.token;
  }

  const jwt = await createSignedJWT(
    serviceAccount,
    "https://www.googleapis.com/auth/analytics.readonly"
  );

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get Google access token: ${error}`);
  }

  const data = await response.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return data.access_token;
}

// Call GA Data API v1beta runReport
export async function runGAReport(
  accessToken: string,
  propertyId: string,
  reportRequest: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const response = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(reportRequest),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GA API error: ${error}`);
  }

  return await response.json();
}
