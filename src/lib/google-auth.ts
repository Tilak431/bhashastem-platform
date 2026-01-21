export function getGoogleCredentials() {
    const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (serviceAccountJson) {
        try {
            return JSON.parse(serviceAccountJson);
        } catch (error) {
            console.error("Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON", error);
            return undefined;
        }
    }
    return undefined;
}
