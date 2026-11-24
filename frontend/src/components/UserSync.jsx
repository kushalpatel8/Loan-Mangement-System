import { useEffect, useRef } from 'react'
import { useUser, useAuth } from '@clerk/react'
import { useNavigate, useLocation } from 'react-router-dom'
import { syncClerkUser } from '../lib/loanWorkflowApi'

export default function UserSync({ onUserSynced }) {
  const { isSignedIn, user } = useUser()
  const { getToken } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  
  const syncedUserIdRef = useRef(null)
  const onUserSyncedRef = useRef(onUserSynced)
  onUserSyncedRef.current = onUserSynced

  useEffect(() => {
    if (!isSignedIn || !user) return

    // Prevent redundant sync loops: sync once per signed-in user ID
    if (syncedUserIdRef.current === user.id) return
    syncedUserIdRef.current = user.id

    const sync = async () => {
      try {
        const email = user.primaryEmailAddress?.emailAddress
        const name = user.fullName || user.firstName || email?.split('@')[0] || 'User'
        const imageUrl = user.imageUrl || ''

        if (email) {
          sessionStorage.setItem('lms_user_email', email)
          localStorage.setItem('lms_user_email', email)
        }
        if (name) {
          sessionStorage.setItem('lms_user_name', name)
          localStorage.setItem('lms_user_name', name)
        }

        const dbUser = await syncClerkUser({
          clerkId: user.id,
          email,
          name,
          imageUrl
        })

        // Check if role was previously selected and cached in local/session storage
        const cachedRole = sessionStorage.getItem('lms_user_role') || localStorage.getItem('lms_user_role')
        const cachedRoleSelected =
          sessionStorage.getItem('lms_role_selected') === 'true' ||
          localStorage.getItem('lms_role_selected') === 'true'

        // If user is already on applicant portal, ensure applicant role is set
        const effectiveRole = dbUser?.role || cachedRole || 'applicant'
        const effectiveRoleSelected = dbUser?.roleSelected ?? (cachedRoleSelected || location.pathname.startsWith('/applicant'))

        const effectiveUser = {
          ...(dbUser || {}),
          role: effectiveRole,
          roleSelected: effectiveRoleSelected
        }

        sessionStorage.setItem('lms_role_selected', String(effectiveRoleSelected))
        sessionStorage.setItem('lms_user_role', effectiveRole)
        localStorage.setItem('lms_role_selected', String(effectiveRoleSelected))
        localStorage.setItem('lms_user_role', effectiveRole)

        if (onUserSyncedRef.current) {
          onUserSyncedRef.current(effectiveUser)
        }

        // Only redirect to /select-role if user is not yet configured AND not already in an active workflow
        if (!effectiveRoleSelected) {
          if (
            location.pathname !== '/select-role' &&
            !location.pathname.startsWith('/applicant') &&
            !location.pathname.startsWith('/sign-in') &&
            !location.pathname.startsWith('/sign-up') &&
            !location.pathname.startsWith('/login')
          ) {
            navigate('/select-role', { replace: true })
          }
        } else {
          // If user landed on /select-role but already has a role locked, navigate to their workspace
          if (location.pathname === '/select-role') {
            const dest =
              effectiveRole === 'admin'
                ? '/admin'
                : effectiveRole === 'loan_officer'
                ? '/officer'
                : '/applicant'
            navigate(dest, { replace: true })
          }
        }
      } catch (err) {
        console.warn('UserSync attempt error:', err)
      }
    }

    sync()
  }, [isSignedIn, user?.id])

  return null
}
