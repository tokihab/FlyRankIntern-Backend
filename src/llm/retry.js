function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getStatusCode(error) {
  if (!error) return null;
  const status = error.status ?? error.statusCode ?? error.response?.status ?? error.code;
  return Number(status) || null;
}

function isRetryableStatus(status) {
  return status === 429 || (status >= 500 && status <= 599);
}

function getNetworkErrorCode(error) {
  return error?.code || error?.cause?.code || error?.cause?.errno || null;
}

function isNetworkError(error) {
  const code = getNetworkErrorCode(error);
  return error?.name === 'APIConnectionError' || error?.name === 'FetchError' || ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN'].includes(code);
}

function isRetryableError(error) {
  return isRetryableStatus(getStatusCode(error)) || isNetworkError(error);
}

function getBackoffMs(attempt) {
  return 500 * (2 ** attempt) + Math.floor(Math.random() * 250);
}

module.exports = {
  sleep,
  getStatusCode,
  isRetryableStatus,
  getNetworkErrorCode,
  isNetworkError,
  isRetryableError,
  getBackoffMs
};
