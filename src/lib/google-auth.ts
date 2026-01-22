export function getGoogleCredentials() {
    const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (serviceAccountJson) {
        try {
            // Log partial info to verify it's loaded without leaking the whole key
            const preview = serviceAccountJson.substring(0, 20) + "...";
            console.log(`[GoogleAuth] Successfully loaded GOOGLE_SERVICE_ACCOUNT_JSON (Length: ${serviceAccountJson.length}, Preview: ${preview})`);

            const creds = JSON.parse(serviceAccountJson);
            if (!creds.project_id) {
                console.error("[GoogleAuth] Parsed JSON is missing 'project_id' field.");
            } else {
                console.log(`[GoogleAuth] Credentials valid for Project ID: ${creds.project_id}`);
            }
            return creds;
        } catch (error) {
            console.error("[GoogleAuth] CRITICAL: Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON", error);
            // Log the raw string (carefully) or part of it if parsing fails to debug format
            console.error("[GoogleAuth] Raw value start:", serviceAccountJson.substring(0, 50));
            return undefined;
        }
    } else {
        console.error("[GoogleAuth] FATAL ERROR: GOOGLE_SERVICE_ACCOUNT_JSON environment variable is NOT set.");
        // Check if other vars exist to see if env is loaded at all
        console.error("[GoogleAuth] Environment check - NODE_ENV:", process.env.NODE_ENV);
    }
    return undefined;
}
