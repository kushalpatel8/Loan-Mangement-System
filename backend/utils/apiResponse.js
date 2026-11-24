// Standardized API response format
export const apiResponse = (res, statusCode = 200, message = "Success", data = null, metadata = null) => {
  const response = {
    success: statusCode >= 200 && statusCode < 300,
    message
  }

  if (data !== null) {
    response.data = data
  }

  if (metadata !== null) {
    response.meta = metadata
  }

  return res.status(statusCode).json(response)
}

export default apiResponse
