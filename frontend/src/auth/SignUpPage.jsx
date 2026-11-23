import { SignUp } from '@clerk/react'

export default function SignUpPage() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 120px)', padding: '2rem 1rem' }}>
      <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
    </div>
  )
}
