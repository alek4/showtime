import { signIn } from './actions'

type Props = {
  searchParams: Promise<{ error?: string }>
}

export default async function LoginPage({ searchParams }: Props) {
  const { error } = await searchParams

  return (
    <div className="min-h-screen bg-void flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-5xl text-primary mb-2 text-center tracking-wider">
          SHOWTIME
        </h1>
        <p className="font-body text-secondary text-center text-sm mb-10">
          Your private watchlist
        </p>

        <form action={signIn} className="flex flex-col gap-4">
          <div>
            <label
              htmlFor="email"
              className="block font-body text-sm text-secondary mb-1.5"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full bg-surface border border-rim rounded-lg px-4 py-3 font-body text-primary placeholder:text-ghost focus:outline-none focus:border-amber"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block font-body text-sm text-secondary mb-1.5"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full bg-surface border border-rim rounded-lg px-4 py-3 font-body text-primary focus:outline-none focus:border-amber"
            />
          </div>

          {error === 'invalid_credentials' && (
            <p className="font-body text-sm text-crimson text-center">
              Invalid email or password.
            </p>
          )}

          <button
            type="submit"
            className="w-full bg-amber text-void font-display text-xl py-3 rounded-lg mt-2 hover:opacity-90 transition-opacity"
          >
            SIGN IN
          </button>
        </form>
      </div>
    </div>
  )
}
