const request = require('supertest');
import { app } from '@Root/Server';
import { promiseTimeout } from '@Helpers/TimeoutPromise';

describe('Search', () => {
    test('should return search results', async () => {
        const queryString = encodeURI("Birmingham");
        let res;

        try {
            res = await promiseTimeout(5000, request(app).get(`/api/search?query=${queryString}`));
        } catch(err) {
            fail("Took too long to respond")
        }

        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('results');
        expect(res.body.results.length).toBeGreaterThan(0);
    })

    test('should return 0 search results', async () => {
        const queryString = encodeURI("zzzzzzzxxxxxyyyyyzzzzzzzzz");
        let res;

        try {
            res = await promiseTimeout(5000, request(app).get(`/api/search?query=${queryString}`));
        } catch(err) {
            fail("Took too long to respond")
        }

        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('results');
        expect(res.body.results).toHaveLength(0);
    })
})