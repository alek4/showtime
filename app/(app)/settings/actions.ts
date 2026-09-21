'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function updateDisplayNameAction(formData: FormData): Promise<void> {
  const displayName = (formData.get('displayName') as string).trim()
  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({
    data: { full_name: displayName },
  })
  if (error) throw error
  redirect('/settings')
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
