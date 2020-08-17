/**
 * Allows for racing a promise, acting as a timeout.
 * @param ms - timeout time in milliseconds
 * @param promise - promise to race.
 */
const promiseTimeout = function (ms: number, promise: Promise<any>) {
    const timeout = new Promise((resolve, reject) => {
        const t = setTimeout(() => {
            clearTimeout(t);
            reject('Request timed out after ' + ms + ' ms.')
        }, ms)
    })

    return Promise.race([
        promise,
        timeout
    ])
}

export { promiseTimeout }