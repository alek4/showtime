import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { updateDisplayNameAction, signOutAction } from './actions'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const displayName: string = (user.user_metadata?.full_name as string | undefined) ?? ''

  return (
    <main className="bg-void min-h-screen pt-6 pb-4">
      <h1 className="font-display text-4xl tracking-wide text-primary px-4 mb-8">
        Settings
      </h1>
      <div className="px-4 space-y-10">
        <section>
          <h2 className="font-display text-2xl tracking-wide text-primary mb-4">
            Display name
          </h2>
          <form action={updateDisplayNameAction} className="flex flex-col gap-3">
            <input
              type="text"
              name="displayName"
              defaultValue={displayName}
              placeholder="Your name"
              className="bg-raised border border-rim rounded-lg px-4 py-3 text-primary font-body placeholder:text-ghost focus:outline-none focus:border-amber"
            />
            <button
              type="submit"
              className="bg-amber text-void font-display text-xl tracking-wide py-3 rounded-lg"
            >
              Save
            </button>
          </form>
        </section>

        <section>
          <h2 className="font-display text-2xl tracking-wide text-primary mb-4">
            Account
          </h2>
          <form action={signOutAction}>
            <button
              type="submit"
              className="w-full bg-crimson-dim text-primary font-display text-xl tracking-wide py-3 rounded-lg border border-crimson"
            >
              Sign out
            </button>
          </form>
        </section>
      </div>
    </main>
  )
}
