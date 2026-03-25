import { supabase } from '../lib/supabase'
import type { AiContentContext, AiContentAction, GenerateAiContentResponse } from '../types'

export interface GenerateAiContentRequest {
  context: AiContentContext
  prompt: string
  current_text?: string
  action: AiContentAction
  metadata?: Record<string, unknown>
}

export async function generateAiContent(
  request: GenerateAiContentRequest,
): Promise<GenerateAiContentResponse> {
  const session = await supabase.auth.getSession()
  const accessToken = session.data.session?.access_token
  if (!accessToken) throw new Error('Non authentifié')

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-ai-content`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(request),
    },
  )

  const data = await res.json()
  if (!res.ok) throw new Error(data?.error || `Erreur ${res.status}`)
  return data as GenerateAiContentResponse
}
