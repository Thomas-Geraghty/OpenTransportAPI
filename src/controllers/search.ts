import { Router } from "express";
import * as url from 'url';
import { ot_database as DB } from '@Data/postgres';
import format = require("pg-format");
import fetch from "node-fetch";
import { promiseTimeout } from "@Root/helpers/TimeoutPromise";


/**
 * SearchController for providing search endpoint
 */
export class SearchController {
    /** 
     * Used for searching stops, routes and addresses.
     * Handles combination of all data sources and ordering
     * by rating. Applies custom weighting to each result type
     */
    static getSearch = async(req, res, next?) => {
        const query = decodeURI(req.query.query);
        const type = req.query.type;

        const data = await Promise.all([
            getNominatimByQuery(req.query.query),
            getStopsByQuery(query),
            getRoutesByQuery(query)
        ])

        const results = [...data[0], ...data[1], ...data[2]];
        const sorted = results
        .map((result) => { 
            const removals = ['Stop'];
            const cleanString = result.string.replace(new RegExp(removals.join("|"),"gi"), "").replace(/[\W_]/g, "");

            let rating = stringRate(cleanString, query);
            if(result.type === 'Address') rating += result.data.importance / 1.3;
            return {
                rating: rating,
                ...result 
            } 
        })
        .sort((a, b) => b.rating - a.rating)

        return res.status(200).json({
            results: sorted
        });
    }
}

/**
 * Searches stop_name in gtfs_stops for matching names to
 * the given query string
 * 
 * @param queryString - string to search by
 */
const getStopsByQuery = async(queryString: string) => {
    queryString = '%' + queryString + '%';
    const SQL = `
    SELECT json_agg(stops) as search
    FROM (
        SELECT  s.stop_id as reference_id,
                'Stop' as type,
                s.stop_name as string
        FROM    gtfs_stops s 
        WHERE 	s.stop_name ILIKE %L
        AND		EXISTS (SELECT 1 FROM gtfs_stoptimes st WHERE st.stop_id = s.stop_id LIMIT 1)
    ) as stops`

    const query = format.withArray(SQL, [queryString]);
    const data = (await DB.query(query))[0].search;
    return data? data : [];
}

/**
 * Searches route_name and route_short_name in gtfs_routes for matching to
 * the given query string
 * 
 * @param queryString - string to search by
 */
const getRoutesByQuery = async(queryString: string) => {
    queryString = '%' + queryString + '%';

    const SQL = `
    SELECT json_agg(routes) as search
    FROM (
        SELECT  r.route_id as reference_id,
                'Route' as type,
                concat(r.route_short_name, ' - ', replace(r.route_long_name,' - ',' to ')) as string
        FROM    gtfs_routes r 
        WHERE 	r.route_long_name ILIKE %L
        OR 		r.route_short_name ILIKE %L
    ) as routes`

    const query = format.withArray(SQL, [queryString, queryString]);
    const data = (await DB.query(query))[0].search;
    return data? data : [];
}

/**
 * Searches Nominatim based on search query, returns addresses. Times out after 3s
 * @param queryString - query string to search addresses by
 */
const getNominatimByQuery = async (queryString: string) => {
    const getUrl: string = url.parse(url.format({
        protocol: 'https',
        hostname: 'nominatim.openstreetmap.org',
        pathname: '/search',
        query: {
            q: queryString,
            format: 'json',
            addressdetails: true,
            countrycodes: 'gb'
        }
    })).href;

    return new Promise<any>((resolve, reject) => {
        promiseTimeout(3*1000, get({ url: getUrl }))
        .then((data: any) => {
            resolve(data.map(address => {
                const data = {
                    display_name: address.display_name,
                    coordinates: [address.lat, address.lon],
                    importance: address.importance
                }
                const string = (address.display_name as string)
                .split(',')
                .slice(0, 2)
                .join(' ');
        
                return { reference_id: address.place_id, type: 'Address', string: string, data: data }
            }))
        })
        .catch(err => {
            resolve([])
        })
    })

}

/**
 * Implementation of Dice coefficient;
 * 
 * @param potentialString - result match
 * @param queryString - search string
 */
const stringRate = (potentialString: string, queryString: string) => {
    const bigramsMap = new Map();
    if (potentialString.length < 2 || queryString.length < 2) return 0;

    for (var i = 0; i < potentialString.length - 1; i++) {
        const bigram = potentialString.substr(i, 2);
        const count = bigramsMap.has(bigram) ? bigramsMap.get(bigram) + 1 : 1;
        bigramsMap.set(bigram, count);
    };

    let intersectionSize = 0;
    for (var j = 0; j < queryString.length - 1; j++) {
        const bigram = queryString.substr(j, 2);
        const count = bigramsMap.has(bigram) ? bigramsMap.get(bigram) : 0;
        if (count > 0) {
            bigramsMap.set(bigram, count - 1);
            intersectionSize++;
        }
    }

    return (intersectionSize * 2 ) / (potentialString.length + queryString.length - 2);
}

const get = async({url, authToken}: {url: string, authToken?: string}): Promise<any> => {
    return new Promise((resolve, reject) => {
        fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                ...authToken !== undefined && { 'Authorization': 'Bearer ' + authToken }
            }
        })
        .then(response => {
            if(response.status >= 400) reject(response.json());
            if(response.status < 400) resolve(response.json());
        })
        .catch(err => reject(err))
    })
} 

export const searchRoutes = Router();
searchRoutes.get('/', SearchController.getSearch);