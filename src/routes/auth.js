const express = require('express');
const router = express.Router();
const zohoOAuthService = require('../utils/zohoOAuthService');

/**
 * @swagger
 * components:
 *   schemas:
 *     TokenResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           description: Operation success status
 *         accessToken:
 *           type: string
 *           description: OAuth access token
 *         refreshToken:
 *           type: string
 *           description: OAuth refresh token
 *         expiresIn:
 *           type: integer
 *           description: Token expiration time in seconds
 *         expiresAt:
 *           type: string
 *           description: Token expiration timestamp
 *     TokenStatus:
 *       type: object
 *       properties:
 *         hasAccessToken:
 *           type: boolean
 *           description: Whether access token exists
 *         hasRefreshToken:
 *           type: boolean
 *           description: Whether refresh token exists
 *         isExpired:
 *           type: boolean
 *           description: Whether current token is expired
 *         expiresAt:
 *           type: string
 *           description: Token expiration timestamp
 *         expiresIn:
 *           type: integer
 *           description: Time until expiration in milliseconds
 */

/**
 * @swagger
 * /api/auth/zoho/authorize:
 *   get:
 *     summary: Get Zoho OAuth authorization URL
 *     description: Returns the authorization URL to initiate OAuth flow with Zoho Creator
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Authorization URL generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 authorizationUrl:
 *                   type: string
 *                   example: "https://accounts.zoho.com/oauth/v2/auth?client_id=...&scope=..."
 *                 instructions:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["1. Visit the authorization URL", "2. Grant permissions", "3. Copy the authorization code", "4. Use /api/auth/zoho/token endpoint"]
 *       500:
 *         description: Error generating authorization URL
 */
router.get('/zoho/authorize', (req, res) => {
  try {
    const authorizationUrl = zohoOAuthService.getAuthorizationUrl();
    
    console.log('🔍 DEBUG - Current redirectUri:', zohoOAuthService.config.redirectUri);
    console.log('🔍 DEBUG - Generated URL:', authorizationUrl);
    
    res.json({
      success: true,
      authorizationUrl,
      instructions: [
        "1. Visit the authorization URL in your browser",
        "2. Log in to your Zoho account and grant permissions",
        "3. Copy the authorization code from the callback URL",
        "4. Use the authorization code with /api/auth/zoho/token endpoint"
      ],
      config: {
        clientId: zohoOAuthService.config.clientId,
        scope: zohoOAuthService.config.scope,
        redirectUri: zohoOAuthService.config.redirectUri
      }
    });
  } catch (error) {
    console.error('❌ Error generating authorization URL:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate authorization URL',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/auth/zoho/token:
 *   post:
 *     summary: Exchange authorization code for access token
 *     description: Exchange the authorization code received from OAuth callback for access and refresh tokens
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               code:
 *                 type: string
 *                 description: Authorization code from OAuth callback
 *                 example: "1000.4567890abcdef1234567890abcdef12.67890abcdef1234567890abcdef123456"
 *             required:
 *               - code
 *     responses:
 *       200:
 *         description: Tokens obtained successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TokenResponse'
 *       400:
 *         description: Missing or invalid authorization code
 *       500:
 *         description: Error exchanging code for tokens
 */
router.post('/zoho/token', async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Authorization code is required',
        message: 'Please provide the authorization code from OAuth callback'
      });
    }
    
    console.log('🔑 Exchanging authorization code for tokens...');
    const tokenResponse = await zohoOAuthService.getAccessToken(code);
    
    res.json({
      ...tokenResponse,
      message: 'Tokens obtained successfully',
      nextSteps: [
        'Access token is now stored and ready for API calls',
        'Use /api/auth/zoho/status to check token status',
        'Use /api/auth/zoho/refresh to refresh tokens when needed'
      ]
    });
    
  } catch (error) {
    console.error('❌ Error getting access token:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to exchange code for tokens',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/auth/zoho/refresh:
 *   post:
 *     summary: Refresh access token
 *     description: Use refresh token to get a new access token
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TokenResponse'
 *       400:
 *         description: No refresh token available
 *       500:
 *         description: Error refreshing token
 */
router.post('/zoho/refresh', async (req, res) => {
  try {
    console.log('🔄 Refreshing access token...');
    const tokenResponse = await zohoOAuthService.refreshAccessToken();
    
    res.json({
      ...tokenResponse,
      message: 'Token refreshed successfully'
    });
    
  } catch (error) {
    console.error('❌ Error refreshing token:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh token',
      details: error.message,
      suggestion: 'You may need to re-authenticate using /api/auth/zoho/authorize'
    });
  }
});

/**
 * @swagger
 * /api/auth/zoho/status:
 *   get:
 *     summary: Get current token status
 *     description: Check the status of current access and refresh tokens
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Token status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *                       example: true
 *                 - $ref: '#/components/schemas/TokenStatus'
 */
router.get('/zoho/status', (req, res) => {
  try {
    const status = zohoOAuthService.getTokenStatus();
    
    res.json({
      success: true,
      ...status,
      message: status.hasAccessToken 
        ? (status.isExpired ? 'Token expired - refresh needed' : 'Token is valid')
        : 'No token available - authentication needed'
    });
    
  } catch (error) {
    console.error('❌ Error getting token status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get token status',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/auth/zoho/clear:
 *   post:
 *     summary: Clear all stored tokens
 *     description: Remove all stored access and refresh tokens (logout)
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Tokens cleared successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "All tokens cleared successfully"
 */
router.post('/zoho/clear', (req, res) => {
  try {
    zohoOAuthService.clearTokens();
    
    res.json({
      success: true,
      message: 'All tokens cleared successfully',
      note: 'You will need to re-authenticate to make API calls'
    });
    
  } catch (error) {
    console.error('❌ Error clearing tokens:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear tokens',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /oauth/callback:
 *   get:
 *     summary: OAuth callback endpoint (for testing)
 *     description: Handles OAuth callback and displays authorization code for manual testing
 *     tags: [Authentication]
 *     parameters:
 *       - in: query
 *         name: code
 *         schema:
 *           type: string
 *         description: Authorization code from Zoho OAuth
 *       - in: query
 *         name: error
 *         schema:
 *           type: string
 *         description: Error from OAuth flow
 *     responses:
 *       200:
 *         description: Callback handled successfully
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 */
router.get('/callback', (req, res) => {
  const { code, error } = req.query;
  
  if (error) {
    res.send(`
      <html>
        <body>
          <h2>❌ OAuth Error</h2>
          <p><strong>Error:</strong> ${error}</p>
          <p><strong>Description:</strong> ${req.query.error_description || 'No description provided'}</p>
          <hr>
          <p><a href="/api/auth/zoho/authorize">Try again</a></p>
        </body>
      </html>
    `);
    return;
  }
  
  if (code) {
    res.send(`
      <html>
        <body>
          <h2>✅ Authorization Code Received</h2>
          <p><strong>Code:</strong> <code>${code}</code></p>
          <hr>
          <p><strong>Next steps:</strong></p>
          <ol>
            <li>Copy the authorization code above</li>
            <li>Send a POST request to <code>/api/auth/zoho/token</code> with the code</li>
            <li>Use the returned access token for API calls</li>
          </ol>
          <hr>
          <p><strong>Example cURL command:</strong></p>
          <pre>
curl -X POST http://localhost:3000/api/auth/zoho/token \\
  -H "Content-Type: application/json" \\
  -d '{"code": "${code}"}'
          </pre>
        </body>
      </html>
    `);
  } else {
    res.send(`
      <html>
        <body>
          <h2>⚠️ No Authorization Code</h2>
          <p>No authorization code or error received in callback.</p>
          <p><a href="/api/auth/zoho/authorize">Start OAuth flow</a></p>
        </body>
      </html>
    `);
  }
});

/**
 * @swagger
 * /api/auth/zoho/reload-tokens:
 *   post:
 *     summary: Reload tokens from file
 *     description: Force reload access and refresh tokens from tokens.json file
 *     responses:
 *       200:
 *         description: Tokens reloaded successfully
 *       500:
 *         description: Error reloading tokens
 */
router.post('/zoho/reload-tokens', async (req, res) => {
  try {
    console.log('🔄 Force reloading tokens from file...');
    
    // Force reload from file
    const fs = require('fs');
    const path = require('path');
    const tokenFile = path.join(process.cwd(), 'tokens.json');
    
    if (fs.existsSync(tokenFile)) {
      const tokens = JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
      zohoOAuthService.setTokens(tokens);
      console.log('✅ Tokens reloaded from file successfully');
      
      res.json({
        success: true,
        message: 'Tokens reloaded successfully',
        expiresAt: new Date(tokens.expiresAt).toISOString(),
        isValid: Date.now() < tokens.expiresAt
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'tokens.json file not found'
      });
    }
  } catch (error) {
    console.error('❌ Error reloading tokens:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reload tokens',
      details: error.message
    });
  }
});

module.exports = router;
