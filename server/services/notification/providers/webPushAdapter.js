const webpush = require('web-push');

// If VAPID keys exist, configure web-push
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

class WebPushAdapter {
  /**
   * Send a push notification
   * @param {Object} subscription - { endpoint, keys: { p256dh, auth } }
   * @param {Object} payload - { title, body, actionUrl }
   * @returns {Promise<boolean>} true if success, throws error on failure
   */
  async send(subscription, payload) {
    if (!process.env.VAPID_PUBLIC_KEY) {
      console.warn('VAPID_PUBLIC_KEY not configured, skipping web push');
      return true; // Skip gracefully in dev
    }

    try {
      await webpush.sendNotification(
        subscription,
        JSON.stringify(payload),
        { timeout: 10000 }
      );
      return true;
    } catch (error) {
      if (error.statusCode === 404 || error.statusCode === 410) {
        // Subscription has expired or is no longer valid
        const err = new Error('Subscription expired');
        err.isExpired = true;
        throw err;
      }
      throw error; // Rethrow for retry logic
    }
  }
}

module.exports = new WebPushAdapter();
