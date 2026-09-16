import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

async function signOut() {
  'use server'
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <main className="p-6">
      <h1 className="font-display text-3xl text-primary mb-2">Watchlist</h1>
      <p className="font-body text-secondary text-sm mb-8">
        Signed in as {user?.email}
      </p>
      <p className="font-body text-ghost text-sm mb-8">
        Coming soon — replaced in Module 8.
      </p>
      <form action={signOut}>
        <button
          type="submit"
          className="font-body text-sm text-secondary underline underline-offset-2"
        >
          Sign out
        </button>
      </form>
    </main>
  )
}
