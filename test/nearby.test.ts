const request = require('supertest');
import { app } from '@Root/Server';
import { promiseTimeout } from '@Helpers/TimeoutPromise';

describe('Nearby Stops', () => {
    test('should fetch 0 nearby stops', async () => {
        const lat = 0;
        const lon = 0;
        const dist = 500;
        let res;

        try {
            res = await promiseTimeout(5000, request(app).get(`/api/transport/nearby?lat=${lat}&lon=${lon}&dist=${dist}`));
        } catch(err) {
            fail("Took too long to respond")
        }

        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('stops');
        expect(res.body.stops).toHaveLength(0);
    });

    test('should fetch 1 nearby stops', async () => {
        const lat = 52.484985; 
        const lon = -1.891678;
        const dist = 100;
        let res;

        try {
            res = await promiseTimeout(5000, 
                    request(app).get(`/api/transport/nearby?lat=${lat}&lon=${lon}&dist=${dist}`));
        } catch(err) {
            fail("Took too long to respond")
        }

        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('stops');
        expect(res.body.stops).toHaveLength(1);
    });

    test('should fetch 44 nearby stops', async () => {
        const lat = 52.484;
        const lon = -1.8922;
        const dist = 500;
        let res;

        try {
            res = await promiseTimeout(5000, request(app).get(`/api/transport/nearby?lat=${lat}&lon=${lon}&dist=${dist}`));
        } catch(err) {
            fail("Took too long to respond")
        }

        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('stops');
        expect(res.body.stops).toHaveLength(44);
    });

    test('should return lat/lon number error', async () => {
        const lat = '52.48d4';
        const lon = -1.8922;
        const dist = 500;
        let res;

        try {
            res = await promiseTimeout(5000, request(app).get(`/api/transport/nearby?lat=${lat}&lon=${lon}&dist=${dist}`));
        } catch(err) {
            fail("Took too long to respond")
        }

        expect(res.statusCode).toEqual(400);
        expect(res.body).toHaveProperty('ApiError');
        expect(res.body.ApiError).toHaveProperty('Message');
        expect(res.body.ApiError.Message).toBe('Both Lat and Lon must be numbers.');
    });

    test('should return dist number error', async () => {
        const lat = 52.484;
        const lon = -1.8922;
        const dist = '5df00';
        let res;

        try {
            res = await promiseTimeout(5000, request(app).get(`/api/transport/nearby?lat=${lat}&lon=${lon}&dist=${dist}`));
        } catch(err) {
            fail("Took too long to respond")
        }

        expect(res.statusCode).toEqual(400);
        expect(res.body).toHaveProperty('ApiError');
        expect(res.body.ApiError).toHaveProperty('Message');
        expect(res.body.ApiError.Message).toBe('Dist must be a number.');
    });
})