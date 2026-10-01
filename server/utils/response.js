const { buildPaginationMeta, hasPaginationRequest } = require('./query');

exports.successResponse = (res, { data = null, message = 'Request successful', statusCode = 200 }) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
};

exports.errorResponse = (res, { message = 'Something went wrong', error = '', statusCode = 500 }) => {
  return res.status(statusCode).json({
    success: false,
    message,
    error,
    statusCode
  });
};

exports.collectionResponse = (
  req,
  res,
  {
    items,
    total,
    page,
    limit,
    statusCode = 200,
    message = 'Request successful',
  }
) => {
  if (hasPaginationRequest(req)) {
    return exports.successResponse(res, {
      statusCode,
      message,
      data: {
        items,
        total,
        page,
        limit
      },
    });
  }

  return exports.successResponse(res, { statusCode, message, data: items });
};

