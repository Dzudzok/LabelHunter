module.exports = (err, req, res, next) => {
  console.error(`[Error] ${err.message}`);
  const isProd = process.env.NODE_ENV === 'production';
  res.status(err.status || 500).json({
    error: isProd ? 'Internal Server Error' : (err.message || 'Internal Server Error'),
  });
};
