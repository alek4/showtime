export type AuthRedirectResult =
  | { action: 'redirect'; to: string }
  | { action: 'continue' }

export function getAuthRedirect(
  isAuthenticated: boolean,
  pathname: string
): AuthRedirectResult {
  const isLoginPage = pathname === '/login'

  if (!isAuthenticated && !isLoginPage) {
    return { action: 'redirect', to: '/login' }
  }
  if (isAuthenticated && isLoginPage) {
    return { action: 'redirect', to: '/' }
  }
  return { action: 'continue' }
}
