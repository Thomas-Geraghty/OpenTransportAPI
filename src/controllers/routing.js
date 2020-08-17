var http = require('http');
var zlib = require("zlib");
var url = require('url');
var osrmTextInstructions = require('osrm-text-instructions')('v5');

var protocol = 'http';
var hostname = 'localhost';
var port = 5000;
var path_prefix = '/route/v1/';
/*
var protocol = 'http';
var hostname = 'router.project-osrm.org'
var port = 80;
*/


function get(path) {
    const request_url = url.parse(url.format({
        protocol: protocol,
        hostname: hostname,
        port: port,
        pathname: path,
        query: {
            steps: true,
            geometries: 'polyline',
            overview: 'full'
        }
    }));

    var chunks = [];

    return new Promise((res) => {
        http.get(request_url, (resp) => {

            resp.on('data', (chunk) => {
                chunks.push(chunk);
            });

            resp.on('end', () => {
                var buffer = Buffer.concat(chunks);
                var encoding = resp.headers['content-encoding'];
                if (encoding == 'gzip') {
                    zlib.gunzip(buffer, (err, decoded) => {
                        res(decoded.toString());
                    });
                } else if (encoding == 'deflate') {
                    zlib.inflate(buffer, (err, decoded) => {
                        res(decoded.toString());
                    })
                } else {
                    res(buffer.toString());
                }
            })
        })
    })
}

function getRoutes(destinations) {

    var promises = [
        getDrivingRoute(destinations)
        //getBikeRoute(destinations),
        //getFootRoute(destinations)
    ]

    return new Promise(resolve => {
        Promise.all(promises).then(results => {
            resolve({
                driving: results[0]
            })
        })
    })
}

function getDrivingRoute(destinations) {
    let path = path_prefix + 'driving/';
    path += formatCoordinates(destinations);

    return new Promise(resolve => {
        get(path).then(response => {

            console.log(response);

            response = JSON.parse(response).routes[0];
            var result = { type: 'driving', instructions: [], duration: response.duration, distance: response.distance, polyline: response.geometry }
    
            response.legs.forEach((leg) => {
                leg.steps.forEach((step) => {
                    result.instructions.push(osrmTextInstructions.compile('en', step));
                });
            });
    
            resolve(result);
        })
    })
}

function getFootRoute(destinations) {
    let path = path_prefix + 'foot/';
    path += formatCoordinates(destinations);

    return get(path);
}

function getBikeRoute(destinations) {
    let path = path_prefix + 'bike/';
    path += formatCoordinates(destinations);

    return get(path);
}

function formatCoordinates(coordinates) {
    let formatted = "";

    coordinates.forEach((destination, index) => {
        destination.reverse();
        formatted += destination.join(',');
        if(index < coordinates.length - 1) {
            formatted += ';'
        }
    })

    console.log(formatted);

    return formatted;
}

module.exports = {
    getRoutes: getRoutes
}