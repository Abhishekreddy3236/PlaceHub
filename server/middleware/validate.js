module.exports = (schema, source = 'body') => (req, res, next) => {
  const parsed = schema.parse(req[source]);
  req[source] = parsed;
  next();
};
