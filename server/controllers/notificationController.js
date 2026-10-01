const Notification = require('../models/Notification');
const PushSubscription = require('../models/PushSubscription');
const AppError = require('../utils/AppError');
const { validationResult } = require('express-validator');

exports.subscribe = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new AppError('Invalid subscription payload', 400));
    }

    const { provider, deviceType, token, deviceMetadata } = req.body;

    // Strict isolation: User identity comes ONLY from JWT
    const userId = req.user._id;

    // Build the query dynamically to prevent { token: undefined } breaking the query
    const filter = { provider };
    if (provider === 'webpush') {
      filter['token.endpoint'] = token.endpoint;
    } else {
      filter.token = token;
    }

    const existing = await PushSubscription.findOne(filter);

    if (existing) {
      // Transfer ownership to current user (handles shared browsers safely)
      existing.userId = userId;
      existing.deviceType = deviceType;
      existing.deviceMetadata = deviceMetadata;
      existing.isActive = true;
      existing.lastUsedAt = Date.now();
      existing.inactiveAt = undefined;
      await existing.save();
      return res.status(200).json({ success: true, message: 'Subscription renewed and ownership claimed' });
    }

    const activeCount = await PushSubscription.countDocuments({
      userId,
      isActive: true
    });

    if (activeCount >= 5) {
      return res.status(403).json({ success: false, message: 'Maximum of 5 active devices allowed.' });
    }

    await PushSubscription.create({
      userId,
      provider,
      deviceType,
      token,
      deviceMetadata,
      isActive: true
    });

    res.status(201).json({ success: true, message: 'Subscribed successfully' });
  } catch (error) {
    if (error.code === 11000) {
      try {
        const { provider, deviceType, token, deviceMetadata } = req.body;
        const userId = req.user._id;
        
        const filter = { provider };
        if (provider === 'webpush') {
          filter['token.endpoint'] = token.endpoint;
        } else {
          filter.token = token;
        }

        const existing = await PushSubscription.findOneAndUpdate(
          filter,
          {
            $set: {
              userId,
              deviceType,
              deviceMetadata,
              isActive: true,
              lastUsedAt: Date.now()
            },
            $unset: {
              inactiveAt: 1
            }
          },
          { new: true, runValidators: true }
        );

        if (existing) {
          return res.status(200).json({ success: true, message: 'Subscription renewed and ownership claimed' });
        }
      } catch (retryError) {
        return next(retryError);
      }
    }
    next(error);
  }
};

exports.unsubscribe = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { subscriptionId, endpoint } = req.body;

    if (!subscriptionId && !endpoint) {
      return next(new AppError('Must provide subscriptionId or endpoint', 400));
    }

    const filter = { userId };
    if (subscriptionId) {
      filter._id = subscriptionId;
    } else {
      filter['token.endpoint'] = endpoint;
    }

    const subscription = await PushSubscription.findOneAndUpdate(
      filter,
      { $set: { isActive: false, inactiveAt: new Date(), lastUsedAt: new Date() } },
      { new: true }
    );

    if (!subscription) {
      return next(new AppError('Subscription not found', 404));
    }

    res.status(200).json({ success: true, message: 'Unsubscribed successfully' });
  } catch (error) {
    next(error);
  }
};

exports.getNotifications = async (req, res, next) => {
  try {
    const userId = req.user._id; // Identity from JWT
    const requestedLimit = Number(req.query.limit);
    const limit =
      Number.isInteger(requestedLimit) && requestedLimit > 0
        ? Math.min(requestedLimit, 50)
        : 20;

    const requestedPage = Number(req.query.page);
    const page =
      Number.isInteger(requestedPage) && requestedPage > 0
        ? requestedPage
        : 1;

    const skip = (page - 1) * limit;

    const notifications = await Notification.find({ recipientId: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const unreadCount = await Notification.countDocuments({ recipientId: userId, isRead: false });

    res.status(200).json({
      success: true,
      data: notifications,
      unreadCount,
      page,
      limit
    });
  } catch (error) {
    next(error);
  }
};

exports.markAsRead = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new AppError('Invalid notification ID', 400));
    }

    const userId = req.user._id; // Enforce ownership
    const notificationId = req.params.id;

    const notif = await Notification.findOneAndUpdate(
      { _id: notificationId, recipientId: userId },
      { $set: { isRead: true, readAt: Date.now() } },
      { new: true }
    );

    if (!notif) {
      return next(new AppError('Notification not found', 404));
    }

    res.status(200).json({ success: true, data: notif });
  } catch (error) {
    next(error);
  }
};

exports.markAllAsRead = async (req, res, next) => {
  try {
    const userId = req.user._id; // Enforce ownership

    await Notification.updateMany(
      { recipientId: userId, isRead: false },
      { $set: { isRead: true, readAt: Date.now() } }
    );

    res.status(200).json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    next(error);
  }
};
