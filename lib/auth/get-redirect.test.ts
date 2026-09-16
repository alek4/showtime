import { describe, it, expect } from 'vitest'
import { getAuthRedirect } from './get-redirect'

describe('getAuthRedirect', () => {
  it('redirects unauthenticated user away from home', () => {
    expect(getAuthRedirect(false, '/')).toEqual({ action: 'redirect', to: '/login' })
  })

  it('redirects unauthenticated user away from nested route', () => {
    expect(getAuthRedirect(false, '/stats')).toEqual({ action: 'redirect', to: '/login' })
  })

  it('allows unauthenticated user to access login page', () => {
    expect(getAuthRedirect(false, '/login')).toEqual({ action: 'continue' })
  })

  it('redirects authenticated user away from login page', () => {
    expect(getAuthRedirect(true, '/login')).toEqual({ action: 'redirect', to: '/' })
  })

  it('allows authenticated user to access home', () => {
    expect(getAuthRedirect(true, '/')).toEqual({ action: 'continue' })
  })

  it('allows authenticated user to access nested route', () => {
    expect(getAuthRedirect(true, '/stats')).toEqual({ action: 'continue' })
  })
})
