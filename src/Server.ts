require('module-alias/register')
import * as dotenv from "dotenv";
dotenv.config();
var argv = require('minimist')(process.argv.slice(2));
import * as http from 'http';
import * as express from "express";
import * as cors from 'cors';
import * as bodyParser from 'body-parser';
import * as compression from 'compression';
import { authRoutes } from '@Controllers/auth';
import { transitRoutes } from '@Controllers/transit';
import { searchRoutes } from '@Controllers/search';
import { ErrorHandler } from '@Helpers/ErrorHandler';
const app = express();
app.use(compression()) // enables gzip compression
app.use(cors()); 
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.options('*', cors());
app.set('json spaces', 4)

/** 
 * Sets up AuthController for verifying users, returning user data etc.
 */
app.use('/api/user/', authRoutes); 

/** 
 * Sets up SearchController for searching by addresses, stops and routes.
 */
app.use('/api/search/', searchRoutes);

/**
 * Sets up TransitController for retrieving transit data.
 */
app.use('/api/transport/', transitRoutes);

/**
 * Default error for any missing routes. Returns a 404.
 */
app.use('/', () => {
  throw new ErrorHandler(404, 'This API endpoint does not exist.')
})

/**
 * Custom middleware for printing of error status
 * Will provide error message, route, time of error 
 * and error code.
 */
app.use((err, req, res, next) => {
  let statusCode: number = err.statusCode || 500;
  let httpStatus: string = '';
  switch(statusCode) {
    case 400:
      httpStatus = 'Bad Request';
      break;
    case 404:
      httpStatus = 'Not Found'
      break;
    case 500:
    default:
      httpStatus = 'Internal Server Error'
      break;
  }

  res.status(statusCode).json({
      ApiError: {
        ExceptionType: 'ApiArgumentException',
        HttpStatus: httpStatus,
        HttpStatusCode: statusCode,
        Message: err.message,
        RelativeUri: req.path,
        TimestampUtc: Date.now()
      }
  });
});

// Creates HTTP server
http.createServer(app);

/**
 * Switch case for providing server on different ports
 * based on ENV variable. 
 */
switch(process.env.NODE_ENV) {
  case 'development':
  case 'production': {

    // Listens on port 5555, or port provided on -p argument.
    let port = argv.p || 5555;
    app.listen(port, function () {
      console.log(`OpenTransport API listening on port ${port}! Go to https://localhost:${port}/`)
    })
    break;
  }
}

export { app };