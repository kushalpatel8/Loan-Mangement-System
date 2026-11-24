import { SignUp } from '@clerk/react'
import { Landmark } from 'lucide-react'

export default function SignUpPage() {
  return (
    <div className="min-h-[calc(100vh-140px)] flex flex-col justify-center items-center py-12 px-4">
      {/* Brand Badge */}
      <div className="mb-6 flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-amber-50/90 border border-amber-200/80 text-amber-900 shadow-xs">
        <Landmark className="w-4 h-4 text-amber-700" />
        <span className="text-xs font-bold tracking-wide">Join Correm Financial Platform</span>
      </div>
      <div className="p-2 rounded-3xl bg-white/70 backdrop-blur-sm border border-stone-200/80 shadow-xl shadow-stone-200/50">
        <SignUp
          routing="path"
          path="/sign-up"
          signInUrl="/sign-in"
          forceRedirectUrl="/select-role"
          fallbackRedirectUrl="/select-role"
        />
      </div>
    </div>
  )
}
