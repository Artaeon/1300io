const { randomUUID } = require('node:crypto');

const HEADER = 'x-request-id';

function requestId(req, res, next) {
  const incoming = req.get(HEADER);
  const id = typeof incoming === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(incoming)
    ? incoming
    : randomUUID();
  req.id = id;
  res.set(HEADER, id);
  next();
}

module.exports = { requestId };
