import { ot_database } from "@Data/postgres";
import * as url from 'url';
import format = require("pg-format");
const { getDayName} = require('@Helpers/date-time')
import { Router } from "express";
import { LatLon } from "@Helpers/LatLon";
import { promiseTimeout } from '@Helpers/TimeoutPromise';
import fetch from "node-fetch";
import { ErrorHandler } from "@Helpers/ErrorHandler";
var GtfsRealtimeBindings = require('gtfs-realtime-bindings');

/**
 * Key: TripID
 * Value:   Key: StopId
 *          Value: ArrivalTime
 */
let delays: Map<string, Map<string, string>> = new Map();
 
/**
 * TransitController for handling all transit information.
 */
export class TransitController {
    static getNearbyStops = async(req, res, next) => {
        const { lat, lon, dist, type } = req.query;
        
        try {
            if(Number.isNaN(Number(dist))) throw new Error("Dist must be a number.");

            const radius: number = Math.min(parseInt(dist), 5000);
            const coordinates = new LatLon(lat, lon);
            const stops = (await getNearby(coordinates, radius)).stops || [];

            res.status(200).json({stops: stops}) 
        } catch(err) {
            next (new ErrorHandler(400, err.message))
        }
    }
 
    static getStopDetails = async(req, res, next) => {
        const { id } = req.params;
        try {
            const details = await getStopDetails(id);
            res.status(200).json(details)
        } catch(err) {
            next(new ErrorHandler(400, err.message))
        }
    }

    static getStopRoutes = async(req, res, next) => {
        const { id } = req.params;
        const routes = (await getStopRoutes(id)).routes || [];
        res.status(200).json({routes: routes}) 
    }

    static getStopDepartures = async(req, res, next) => {
        const { id } = req.params;
        const departures = (await getStopDepartures(id)).departures || [];
        res.status(200).json({departures: departures}) 
    }

    static getRouteDetails = async(req, res, next) => {
        const { id } = req.params;
        const details = await getRouteDetails(id);
        res.status(200).json(details);
    }
}

/**
 * Returns all nearby stops based on given coordinates and the radius of the search
 * @param coordinates - center point coordinates
 * @param radius - distance from center to search
 */
const getNearby = async(coordinates: LatLon, radius: number) => {
    const SQL = `
        SELECT json_agg(stops) as stops
        FROM (
            SELECT  stop_id, stop_code, stop_name, stop_lat, stop_lon, stop_timezone, vehicle_type
            FROM    gtfs_stops s 
            WHERE   EXISTS (SELECT 1 FROM gtfs_stoptimes st WHERE st.stop_id = s.stop_id LIMIT 1)
            AND   St_DWithin(s.stop_location, %s::geography, %L)
            ORDER BY St_Distance(s.stop_location, %s)
        ) stops`

    const point = `St_Point('${coordinates.lon}', '${coordinates.lat}')`;
    const query = format.withArray(SQL, [point, radius, point]);

    return (await ot_database.query(query))[0];
}

/**
 * Returns details about a stop, including details of the routes which
 * service it.
 * 
 * @param stopId - id of stop to get details of
 */
const getStopDetails = async(stopId: string) => {
    const SQL =`
    SELECT 
	    row_to_json(x) as stop
    FROM (
        SELECT 	s.*,
                array(
                    SELECT 		row_to_json(x)
                    FROM (
                        SELECT 		DISTINCT ON (r.route_id) r.route_id,
                                    r.route_type,
                                    r.route_short_name,
                                    r.route_long_name,
                                    (array_agg(a.*))[1] as agency,
                                    array[r.route_text_color, r.route_color] as route_colors
                        FROM 		gtfs_stoptimes st
                        INNER JOIN 	gtfs_trips t ON (t.trip_id = st.trip_id)
                        INNER JOIN 	gtfs_routes r ON (r.route_id = t.route_id)
                        INNER JOIN	gtfs_agency a ON (a.agency_id = r.agency_id)
                        WHERE		st.stop_id = s.stop_id
                        GROUP BY	r.route_id, st.stop_id
                    ) x
                ) routes 
        FROM 	gtfs_stops s
        WHERE s.stop_id = %L
        GROUP BY s.stop_id
    ) x`
    
    const query = format.withArray(SQL, [stopId]);
    const response = (await ot_database.query(query))[0];
    if(!response) throw new Error("Stop does not exist");
    return response;
}

/**
 * Gets all the routes connected to a stop, including all the stops serviced by
 * each route. Warning: Can take a long time.
 * 
 * @param stopId - id of stop which routes to get
 */
const getStopRoutes = async(stopId: string) => {
    const SQL = `
    SELECT json_agg(routes) as routes
    FROM (
        SELECT 	r.route_id,
                r.route_type,
                r.route_short_name,
                r.route_long_name,
                (array_agg(a.*))[1] as agency,
                array[r.route_text_color, r.route_color] as route_colors,
                (
                    SELECT 	json_agg(x)
                    FROM	(
                        SELECT 	s.stop_id, s.stop_code, s.stop_name, s.stop_lat, 
                                s.stop_lon, s.stop_timezone, s.vehicle_type
                        FROM gtfs_stoptimes st
                        INNER JOIN (
                            SELECT 	t.trip_id
                            FROM 	gtfs_trips t
                            INNER JOIN gtfs_stoptimes st ON (st.trip_id = t.trip_id)
                            WHERE 	t.route_id = r.route_id
                            AND		st.stop_id = %L
                            LIMIT 1
                        ) as trips ON (trips.trip_id = st.trip_id)
                        INNER JOIN	gtfs_stops s ON (s.stop_id = st.stop_id)
                        ORDER BY st.stop_sequence 
                    ) as x
                ) as stops
        FROM gtfs_routes r
        INNER JOIN gtfs_agency a ON (a.agency_id = r.agency_id)
        WHERE r.route_id IN (
            SELECT 	DISTINCT t.route_id
            FROM 	gtfs_stoptimes st
            INNER JOIN gtfs_trips t ON (t.trip_id = st.trip_id)
            WHERE 	st.stop_id = %L
        )
        GROUP BY r.route_id
    ) routes`
    const query = format.withArray(SQL, [stopId, stopId]);
    return (await ot_database.query(query))[0];
}

/**
 * Gets the next 24h worth of departures for a stop.
 * Limits itself to 100 as to not be too large.
 * 
 * @param stopId - id of stop to get departures of
 */
const getStopDepartures = async(stopId: string) => {
    const now = new Date(Date.now());
    const nowDate = now.getFullYear() + '/' + (now.getMonth() + 1) + '/' + now.getDate();
    const nowName = getDayName(now.getDay());

    const tomorrow = new Date(Date.now() + 8.64e+7);
    const tomorrowDate = tomorrow.getFullYear() + '/' + (tomorrow.getMonth() + 1) + '/' + tomorrow.getDate();
    const tomorrowName = getDayName(tomorrow.getDay());

    const departureTime = now.getHours() + ':' + now.getMinutes();

    const SQL = `SELECT 
                json_agg(row_to_json(x)) as departures
                FROM (
                SELECT 
                    departures.route_id,
                    departures.trip_id,
                    departures.trip_headsign,
                    departures.stop_platform,
                    departures.departure_time,
                    departures.date
                    FROM (
                        SELECT 		today.*,
                                    t.trip_headsign,
                                    t.route_id,
                                    %L as date
                        FROM 		gtfs_stoptimes today
                        INNER JOIN 	gtfs_trips t ON (t.trip_id  = today.trip_id)
                        INNER JOIN 	gtfs_routes r ON (r.route_id = t.route_id)
                        INNER JOIN 	gtfs_calendar c ON (c.service_id = t.service_id)
                        WHERE 		today.stop_id = %L
                        %s
                        UNION
                        SELECT 		tomorrow.*,
                                    t.trip_headsign,
                                    t.route_id,
                                    %L as date
                        FROM 		gtfs_stoptimes tomorrow
                        INNER JOIN 	gtfs_trips t ON (t.trip_id  = tomorrow.trip_id)
                        INNER JOIN 	gtfs_routes r ON (r.route_id = t.route_id)
                        INNER JOIN 	gtfs_calendar c ON (c.service_id = t.service_id)
                        WHERE 		tomorrow.stop_id = %L
                        %s
                        ORDER BY	date, departure_time
                        LIMIT 100
                    ) departures
                ) x`

    const whereClauseNow =   `AND (c.start_date <= '${nowDate}' AND c.end_date > '${nowDate}')
                                AND (c.${nowName} = 1 AND today.departure_time >= '${departureTime}')`
    const whereClauseTomorrow = `AND (c.start_date <= '${tomorrowDate}' AND c.end_date > '${tomorrowDate}')
                                 AND (c.${tomorrowName} = 1 AND tomorrow.departure_time < '${departureTime}') `

    const query = format.withArray(SQL, [nowDate, stopId, whereClauseNow, tomorrowDate, stopId, whereClauseTomorrow]);
    const data = (await ot_database.query(query))[0];

    if(data.departures) {
        data.departures.forEach(departure => {
            const departureTripId = departure.trip_id;
            const departureStopId = stopId;
            if(departure.date === nowDate && delays.has(departureTripId)) {
                if(delays.get(departureTripId).has(departureStopId)) {
                    departure.revised_departure_time = delays.get(departureTripId).get(departureStopId);
                }
            }
        })
    }

    return data;
}

/**
 * Gets route info, including route data and all routes stops.
 * 
 * @param routeId - id of route to get
 */
const getRouteDetails = async(routeId: string) => {
    const SQL = `
    SELECT json_agg(row_to_json(route)) as route
    FROM (
        SELECT	DISTINCT ON (r.route_id) r.route_id,
                r.route_type,
                r.route_short_name,
                r.route_long_name,
                (array_agg(a.*))[1] as agency,
                array[r.route_text_color, r.route_color] as route_colors,
                json_agg(to_jsonb(st) - 'trip_id') as stops
        FROM 	gtfs_routes r
        INNER JOIN gtfs_trips t ON (t.route_id = r.route_id)
        INNER JOIN gtfs_agency a ON (a.agency_id = r.agency_id)
        INNER JOIN (
                        SELECT 	st.trip_id,
                            s.stop_id, s.stop_code, s.stop_name, s.stop_lat, 
                            s.stop_lon, s.stop_timezone, s.vehicle_type
                        FROM gtfs_stoptimes st
                        INNER JOIN gtfs_stops s ON (st.stop_id = s.stop_id)
                    ) 	st ON (st.trip_id = t.trip_id)
        WHERE	r.route_id = %L
        GROUP BY r.route_id, t.trip_id
    ) route`

    const query = format.withArray(SQL, [routeId]);
    return (await ot_database.query(query))[0];
}

/**
 * Sorts live departures and stores them for matching against static data.
 * TODO: Re-write to work with multiple different data-sources for GTFS-RT
 * @param appId - TfWM app id
 * @param appKey - TfWM app key
 */
const getLiveDepartures = async(appId: string, appKey: string) => {
    const getUrl: string = url.parse(url.format({
        protocol: 'http',
        hostname: 'api.tfwm.org.uk',
        pathname: '/gtfs/trip_updates',
        query: {
            app_id: appId,
            app_key: appKey
        }
    })).href;

    promiseTimeout(30*1000, get({ url: getUrl }))
    .then(data => {
        const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(data);
        const updatedDelays: Map<string, Map<string, string>> = new Map();
    
        feed.entity.forEach(feedEntity => {
            const { stopTimeUpdate, trip } = feedEntity.tripUpdate;
            if(!updatedDelays.has(trip.tripId)) updatedDelays.set(trip.tripId, new Map<string, string>());
    
            stopTimeUpdate.forEach(timeUpdate => {
                if(timeUpdate.departure) {
                    const delay = new Date(timeUpdate.departure.time.low * 1000);
                    const hours = delay.getHours().toString().padStart(2, '0');
                    const minutes = delay.getMinutes().toString().padStart(2, '0');
                    const seconds = delay.getSeconds().toString().padStart(2, '0');
                    const delayFormatted = hours + ':' + minutes + ':' + seconds;
                    updatedDelays.get(trip.tripId).set(timeUpdate.stopId, delayFormatted);
                }
            })
        });
    
        delays = updatedDelays;
    })
    .catch(error => {
    })
}

/**
 * Returns buffer data from provided URL
 * @param {url, authToken?} - Provide url and authToken for connecting to GTFS-RT datasource
 */
const get = async({url, authToken}: {url: string, authToken?: string}): Promise<any> => {
    return new Promise((resolve, reject) => {
        fetch(url, {
            method: 'GET',
            headers: {
                ...authToken !== undefined && { 'Authorization': 'Bearer ' + authToken }
            }
        })
        .then(response => {
            if(response.status >= 400) reject(response);
            if(response.status < 400) resolve(response.buffer());
        })
        .catch(err => reject(err))
    })
} 

/**
 * Auto-refresher of live departure data from TfWM
 * //TODO: Rewrite to make use of multiple different GTFS-RT feeds.
 */
const autoRefreshDepartureData = () => {
    getLiveDepartures(process.env.TFWM_APP_ID, process.env.TFWM_APP_KEY);
    setInterval(() => {
        getLiveDepartures(process.env.TFWM_APP_ID, process.env.TFWM_APP_KEY);
    }, 300*1000)
}

/* Only attempt to download live departure when not in Test mode */
if (process.env.NODE_ENV !== 'test') {
    autoRefreshDepartureData();
}

export const transitRoutes = Router();

// All transit routes connected to their endpoint
transitRoutes.get('/nearby', TransitController.getNearbyStops);
transitRoutes.get('/route/:id/details', TransitController.getRouteDetails);
transitRoutes.get('/stop/:id/details', TransitController.getStopDetails);
transitRoutes.get('/stop/:id/routes', TransitController.getStopRoutes);
transitRoutes.get('/stop/:id/departures', TransitController.getStopDepartures);