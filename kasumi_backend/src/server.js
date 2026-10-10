const express = require('express');
const cors = require('cors');
const dogrun = require('./dogrun/api');
const pacmaze = require('./pacmaze/api');
const spaceadventure = require('./spaceadventure/api');
const battleship = require('./battleship/api');
const puddel = require('./puddel/api');

const app = express();

// Do not advertise the framework
app.disable('x-powered-by');

// Security headers middleware
app.use((req, res, next) => {
  // Prevent clickjacking attacks
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Control referrer information
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions Policy - restrict access to browser features
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()');
  
  // Content Security Policy for API responses
  res.setHeader('Content-Security-Policy', [
    "default-src 'none'",
    "script-src 'none'",
    "style-src 'none'",
    "img-src 'none'",
    "font-src 'none'",
    "connect-src 'self'", // Allow API calls from same origin
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'none'"
  ].join('; '));
  
  // Strict Transport Security (only if using HTTPS)
  // Uncomment and adjust max-age if deploying with HTTPS
  // res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  
  next();
});

// Configure CORS with security best practices
// Update allowed origins based on your deployment
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:4173']; // Default to common SvelteKit dev/preview ports

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400 // 24 hours
}));

// Parse JSON bodies with a small size limit; the API only receives tiny payloads
app.use(express.json({ limit: '16kb' }));

// Return a clean 400 on malformed JSON instead of a stack trace
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON' });
  }
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Payload too large' });
  }
  next(err);
});

// Use sub-project routes
app.use('/api', dogrun);
app.use('/api', pacmaze);
app.use('/api', spaceadventure);
app.use('/api', battleship);
app.use('/api', puddel);

app.listen(3000, () => {
  console.log('Backend server running on port 3000');
});