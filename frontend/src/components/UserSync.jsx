import { useEffect, useRef } from 'react'
import { useUser, useAuth } from '@clerk/react'
import { useNavigate, useLocation } from 'react-router-dom'
import { syncClerkUser } from '../lib/loanWorkflowApi'

export default function UserSync({ onUserSynced }) {
  const { isSignedIn, user } = useUser()
  const { getToken } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const syncedRef = useRef(false)

  useEffect(() => {
    if (!isSignedIn || !user) return

    const sync = async () => {
      try {
        const email = user.primaryEmailAddress?.emailAddress
        const name = user.fullName || user.firstName || email?.split('@')[0] || 'User'
        const imageUrl = user.imageUrl || ''

        const dbUser = await syncClerkUser({
          clerkId: user.id,
          email,
          name,
          imageUrl
        })

        syncedRef.current = true

        // Check if role was previously selected and cached in local/session storage
        const cachedRole = sessionStorage.getItem('lms_user_role') || localStorage.getItem('lms_user_role')
        const cachedRoleSelected =
          sessionStorage.getItem('lms_role_selected') === 'true' ||
          localStorage.getItem('lms_role_selected') === 'true'

        const effectiveUser = dbUser || (cachedRoleSelected ? { role: cachedRole, roleSelected: true } : null)

        if (onUserSynced && effectiveUser) {
          onUserSynced(effectiveUser)
        }

        // If user has not permanently selected their role yet, redirect to /select-role
        if (effectiveUser && !effectiveUser.roleSelected) {
          sessionStorage.setItem('lms_role_selected', 'false')
          if (
            location.pathname !== '/select-role' &&
            !location.pathname.startsWith('/sign-in') &&
            !location.pathname.startsWith('/sign-up') &&
            !location.pathname.startsWith('/login')
          ) {
            navigate('/select-role', { replace: true })
          }
        } else if (effectiveUser && effectiveUser.roleSelected) {
          sessionStorage.setItem('lms_role_selected', 'true')
          sessionStorage.setItem('lms_user_role', effectiveUser.role)
          localStorage.setItem('lms_role_selected', 'true')
          localStorage.setItem('lms_user_role', effectiveUser.role)

          // If user lands on /select-role but already has a role locked, navigate to their workspace
          if (location.pathname === '/select-role') {
            const dest =
              effectiveUser.role === 'admin'
                ? '/admin'
                : effectiveUser.role === 'loan_officer'
                ? '/officer'
                : '/applicant'
            navigate(dest, { replace: true })
          }
        } else if (!dbUser && !cachedRoleSelected) {
          // Backend offline and no local role set yet -> prompt role selection
          if (
            location.pathname !== '/select-role' &&
            !location.pathname.startsWith('/sign-in') &&
            !location.pathname.startsWith('/sign-up') &&
            !location.pathname.startsWith('/login') &&
            location.pathname !== '/'
          ) {
            navigate('/select-role', { replace: true })
          }
        }
      } catch (err) {
        console.warn('UserSync attempt error:', err)
      }
    }

    sync()
  }, [isSignedIn, user, getToken, location.pathname, navigate, onUserSynced])

  return null
}
