const webPushAdapter = require('./webPushAdapter');

class ProviderFactory {
  getProvider(providerName) {
    switch (providerName) {
      case 'webpush':
        return webPushAdapter;
      case 'fcm':
        throw new Error('FCM provider not yet implemented');
      case 'apns':
        throw new Error('APNs provider not yet implemented');
      default:
        throw new Error(`Unknown provider: ${providerName}`);
    }
  }
}

module.exports = new ProviderFactory();
