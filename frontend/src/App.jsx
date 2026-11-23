import { Show, SignInButton, SignUpButton, UserButton } from '@clerk/react'

function App() {
  return (
    <div style={{ minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ padding: '1rem 2rem', borderBottom: '1px solid #e2e8f0', background: '#ffffff' }}>
        <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '1200px', margin: '0 auto' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0, color: '#1a202c' }}>
            Loan Management System
          </h1>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <Show when="signed-out">
              <SignInButton mode="modal">
                <button style={{ padding: '0.5rem 1rem', cursor: 'pointer', borderRadius: '4px', border: '1px solid #cbd5e0', background: '#f7fafc', fontWeight: 500 }}>
                  Sign In
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button style={{ padding: '0.5rem 1rem', cursor: 'pointer', borderRadius: '4px', border: 'none', background: '#3182ce', color: '#fff', fontWeight: 500 }}>
                  Sign Up
                </button>
              </SignUpButton>
            </Show>
            <Show when="signed-in">
              <UserButton />
            </Show>
          </div>
        </nav>
      </header>
      <main style={{ maxWidth: '1200px', margin: '2rem auto', padding: '0 2rem' }}>
        <p>Welcome to the Loan Management System.</p>
      </main>
    </div>
  )
}

export default App
