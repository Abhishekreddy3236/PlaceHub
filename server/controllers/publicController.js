const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const shareTokenService = require('../services/shareTokenService');

exports.handleResumeShare = asyncHandler(async (req, res, next) => {
  const { token } = req.params;

  if (!token || token.length !== 64) {

    return next(new AppError('Resume link is invalid or has expired', 404));
  }


  res.setHeader('Cache-Control', 'no-store, private');

  try {
    const signedUrl = await shareTokenService.resolveTokenToSignedUrl(token);

    return res.redirect(302, signedUrl);
  } catch (error) {

    const status = error.statusCode || 404;
    const message = error.isOperational ? error.message : 'Resume link is invalid or has expired';


    res.status(status).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Link Unavailable</title>
          <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #f8fafc; color: #334155; }
              .container { text-align: center; padding: 2rem; background: white; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); max-width: 400px; }
              h1 { font-size: 1.5rem; font-weight: 600; margin-bottom: 0.5rem; color: #0f172a; }
              p { font-size: 0.95rem; line-height: 1.5; margin-bottom: 1.5rem; color: #64748b; }
          </style>
      </head>
      <body>
          <div class="container">
              <h1>Link Unavailable</h1>
              <p>${message}</p>
          </div>
      </body>
      </html>
    `);
  }
});
