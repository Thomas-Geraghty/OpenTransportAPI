/**
 * Custom type for holding and validating coordinates. 
 */
export class LatLon {
    static readonly LAT_MIN: number = -90;
    static readonly LAT_MAX: number = 90;
    static readonly LON_MIN: number = -180;
    static readonly LON_MAX: number = 180;

    readonly lat: number;
    readonly lon: number;
    
    constructor(lat: number | string, lon: number | string) {
        lat = Number(lat);
        lon = Number(lon);

        if (isNaN(lat) || isNaN(lon)) {
            throw new Error('Both Lat and Lon must be numbers.');
        }

        this.lat = Math.min(Math.max(lat, LatLon.LAT_MIN), LatLon.LAT_MAX);
        this.lon = Math.min(Math.max(lon, LatLon.LON_MIN), LatLon.LON_MAX);
    }

    /** 
     * Provides LatLon object as a coordinate
     */
    toString() {
        return `${this.lat}, ${this.lon}`;
    }
}