/**
 * Custom error handler for making error returning easier.
 */
export class ErrorHandler extends Error {
    statusCode: number;

    constructor(statusCode: number, message: string) {
        super();
        this.statusCode = statusCode;
        this.message = message;
    }
}