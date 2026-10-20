export function authCookieOptions(config, maxAge) {
  return {
    httpOnly: true,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
    path: config.cookie.path,
    ...(config.cookie.domain ? { domain: config.cookie.domain } : {}),
    ...(typeof maxAge === 'number' ? { maxAge } : {}),
  }
}

export function clearAuthCookie(res, config) {
  res.clearCookie(config.cookie.name, authCookieOptions(config))
}
