/**
 * Central API utility following the votersai pattern.
 * Uses native fetch with credentials: 'omit' to bypass CSRF.
 */

export const callAPI = async (method, endpoint, body = null, options = {}) => {
  const token = localStorage.getItem('frappe_token')
  
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...options.headers
  }

  const config = {
    method: method.toUpperCase(),
    headers,
    credentials: 'omit', // Default to omit to bypass CSRF
    ...options
  }

  if (token) {
    headers['Authorization'] = `token ${token}`
  } else {
    // If no token (login phase), we might need cookies
    config.credentials = 'include'
  }

  if (body) {
    config.body = typeof body === 'string' ? body : JSON.stringify(body)
  }

  const response = await fetch(endpoint, config)
  
  const data = await response.json()
  
  if (!response.ok) {
    // If token is invalid (401), clear and reload
    if (response.status === 401 && token) {
      localStorage.removeItem('frappe_token')
      window.location.reload()
    }
    throw new Error(parseFrappeError(data) || `API request failed (HTTP ${response.status})`)
  }
  
  return data
}

/**
 * Extracts the readable error from a Frappe error response body.
 */
export const parseFrappeError = (data) => {
  if (!data) return null
  try {
    if (data._server_messages) {
      return JSON.parse(data._server_messages)
        .map(m => JSON.parse(m).message)
        .join(' ')
        .replace(/<[^>]*>/g, '')
    }
  } catch {
    // fall through to the raw fields below
  }
  return data.exception || (typeof data.message === 'string' ? data.message : null)
}

/**
 * Readable message for an axios error, a callAPI error, or a client-side exception.
 */
export const getErrorMessage = (e) => {
  if (e?.response) {
    return parseFrappeError(e.response.data) || `HTTP ${e.response.status}`
  }
  return e?.message || 'Unknown error'
}

export const get = (endpoint, options = {}) => callAPI('GET', endpoint, null, options)
export const post = (endpoint, body, options = {}) => callAPI('POST', endpoint, body, options)
export const put = (endpoint, body, options = {}) => callAPI('PUT', endpoint, body, options)
export const del = (endpoint, options = {}) => callAPI('DELETE', endpoint, null, options)
