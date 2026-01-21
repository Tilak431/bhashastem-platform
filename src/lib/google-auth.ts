export function getGoogleCredentials() {
    const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (serviceAccountJson) {
        try {
            console.log("Attempting to parse GOOGLE_SERVICE_ACCOUNT_JSON of length:", serviceAccountJson.length);
            const creds = JSON.parse(serviceAccountJson);
            console.log("Successfully parsed Google Credentials for project:", creds.project_id);
            return creds;
        } catch (error) {
            console.error("Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON", error);
            return undefined;
        }
    } else {
        console.warn("GOOGLE_SERVICE_ACCOUNT_JSON environment variable is NOT set.");
    }
    return undefined;
}
