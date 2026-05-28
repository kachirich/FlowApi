import jwt from 'jsonwebtoken';

/**
 * Core utility to generate the JWT and attach it to the Express response
 * as a strict HttpOnly cookie using dynamic environment logic.
 * 
 * @param {Object} user - The authenticated user object (must contain id and email)
 * @param {Object} res - The Express response object
 */
export const generateAuthCookie = (user, res) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is missing from process.env!");
  }

  const token = jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "24h" }
  );

  const isProd = process.env.NODE_ENV === 'production';
  
  res.cookie('jwt', token, {
    maxAge: 24 * 60 * 60 * 1000, // 1 day
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax'
  });
};

/**
 * Standardized response handler for Email/Password and OTP flows.
 * Attaches the cookie and returns a sanitized JSON payload.
 * 
 * @param {Object} user - The authenticated user object
 * @param {number} statusCode - The HTTP success status code (e.g., 200, 201)
 * @param {Object} res - The Express response object
 * @param {string} message - The success message to include in the JSON
 */
export const sendTokenResponse = (user, statusCode, res, message) => {
  try {
    generateAuthCookie(user, res);
    
    return res.status(statusCode).json({
      success: true,
      message,
      user: { 
        id: user.id, 
        email: user.email, 
        first_name: user.first_name, 
        last_name: user.last_name 
      }
    });
  } catch (error) {
    console.error("Cookie generation error:", error);
    return res.status(500).json({ error: error.message || "Failed to generate authentication token" });
  }
};
