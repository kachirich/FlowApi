// middleware/errorHandler.js

export const errorHandler = (err, req, res, next) => {
  // 1. Log the error internally for your eyes only
  console.error(`[Error 💥] ${err.message}`);

  // 2. Determine the status code (default to 500 Internal Server Error)
  const statusCode = err.statusCode || 500;
  
  // 3. Check the environment
  const environment = process.env.NODE_ENV || 'development';

  // 4. Send the normalized JSON response
  res.status(statusCode).json({
    status: 'error',
    timestamp: new Date().toISOString(),
    message: environment === 'production' && statusCode === 500 
      ? 'Internal Server Error' 
      : err.message,
    // Only show the stack trace if we are actively developing
    ...(environment === 'development' && { stack: err.stack })
  });
};
