/**
 * Async Handler Utility Wrapper
 * 
 * In Express (version 4 and below), if an asynchronous route handler throws an error
 * (for example, a database query fails or a network request rejects), the promise 
 * rejection is unhandled. If not caught, this can crash the Node.js server.
 * 
 * This wrapper takes an asynchronous request handling function, executes it inside 
 * a Promise, and automatically forwards any thrown errors or rejections to 
 * Express's next() function (which triggers the global error handler middleware).
 * 
 * This allows us to write clean async/await controller logic without wrapping 
 * every single controller in a try-catch block manually.
 * 
 * @param {Function} fn - The asynchronous middleware/controller function to wrap.
 * @returns {Function} - An Express-compatible middleware function.
 */
export const asyncHandler = (fn) => (req, res, next) => {
  // Resolve the function output as a Promise, and catch any rejections to pass to next()
  Promise.resolve(fn(req, res, next)).catch(next);
};
