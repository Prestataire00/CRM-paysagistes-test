import { useMutation } from '@tanstack/react-query'
import { generateAiContent } from '../services/ai-content.service'
import type { GenerateAiContentRequest } from '../services/ai-content.service'

export function useGenerateAiContent() {
  return useMutation({
    mutationFn: (request: GenerateAiContentRequest) => generateAiContent(request),
  })
}
