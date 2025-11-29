const EARTH_RADIUS_KM = 6371;
const DEG_LAT_KM = 111.32;

export function calculateCentroid(latitudes = [], longitudes = []) {
    if (!Array.isArray(latitudes) || !Array.isArray(longitudes)) {
        return null;
    }
    const length = Math.min(latitudes.length, longitudes.length);
    if (!length) {
        return null;
    }

    const latSum = latitudes.slice(0, length).reduce((sum, value) => sum + value, 0);
    const lonSum = longitudes.slice(0, length).reduce((sum, value) => sum + value, 0);

    return {
        latitude: latSum / length,
        longitude: lonSum / length
    };
}

export function buildBoundingBox(latitude, longitude, radiusKm) {
    const deltaLat = radiusKm / DEG_LAT_KM;
    const cosLat = Math.cos(toRadians(latitude)) || 1e-6;
    const deltaLon = radiusKm / (DEG_LAT_KM * cosLat);

    return {
        minLat: latitude - deltaLat,
        maxLat: latitude + deltaLat,
        minLon: longitude - deltaLon,
        maxLon: longitude + deltaLon
    };
}

export function haversineDistanceKm(a, b) {
    if (!a || !b) {
        return Infinity;
    }

    const dLat = toRadians(b.latitude - a.latitude);
    const dLon = toRadians(b.longitude - a.longitude);

    const lat1 = toRadians(a.latitude);
    const lat2 = toRadians(b.latitude);

    const hav = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(hav), Math.sqrt(1 - hav));
    return EARTH_RADIUS_KM * c;
}

function toRadians(value) {
    return (value * Math.PI) / 180;
}

export default {
    calculateCentroid,
    buildBoundingBox,
    haversineDistanceKm
};
