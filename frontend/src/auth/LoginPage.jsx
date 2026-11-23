import { SignIn } from '@clerk/react'

export default function LoginPage() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 120px)', padding: '2rem 1rem' }}>
      <SignIn routing="path" path="/login" signUpUrl="/sign-up" />
    </div>
  )
}
