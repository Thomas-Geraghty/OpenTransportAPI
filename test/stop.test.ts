const request = require('supertest');
import { app } from '@Root/Server';
import { promiseTimeout } from '@Helpers/TimeoutPromise';

describe('Stop Information', () => {
    test('should return correct stop properties', async () => {
        const stopId = `43002104401`;
        let res;

        try {
            res = await promiseTimeout(5000, request(app).get(`/api/transport/stop/${stopId}/details`));
        } catch(err) {
            fail("Took too long to respond")
        }

        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('stop');
        expect(res.body.stop.stop_id).toBe(stopId);
    })

    test('should return stop departures', async () => {
        const stopId = `43002104401`;
        let res;

        try {
            res = await promiseTimeout(5000, request(app).get(`/api/transport/stop/${stopId}/departures`));
        } catch(err) {
            fail("Took too long to respond")
        }

        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('departures');
    })

    test('should return stop routes', async () => {
        const stopId = `43002104401`;
        let res;

        try {
            res = await promiseTimeout(5000, request(app).get(`/api/transport/stop/${stopId}/routes`));
        } catch(err) {
            fail("Took too long to respond")
        }

        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('routes');
    })

    test('should return a "stop doesnt exist" error', async () => {
        const stopId = `thisStopWontExist`;
        let res;

        try {
            res = await promiseTimeout(5000, request(app).get(`/api/transport/stop/${stopId}/details`));
        } catch(err) {
            fail("Took too long to respond")
        }

        expect(res.statusCode).toEqual(400);
        expect(res.body).toHaveProperty('ApiError');
        expect(res.body.ApiError).toHaveProperty('Message');
        expect(res.body.ApiError.Message).toBe('Stop does not exist');
    })

    test('should return 0 routes', async () => {
        const stopId = `thisStopWontExist`;
        let res;

        try {
            res = await promiseTimeout(5000, request(app).get(`/api/transport/stop/${stopId}/routes`));
        } catch(err) {
            fail("Took too long to respond")
        }

        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('routes');
        expect(res.body.routes).toHaveLength(0);
    })

    test('should return 0 departures', async () => {
        const stopId = `thisStopWontExist`;
        let res;

        try {
            res = await promiseTimeout(5000, request(app).get(`/api/transport/stop/${stopId}/departures`));
        } catch(err) {
            fail("Took too long to respond")
        }

        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('departures');
        expect(res.body.departures).toHaveLength(0);
    })
})