import { create } from 'zustand'

interface TextPromptRequest {
  title: string
  label?: string
  defaultValue: string
  placeholder?: string
  resolve: (value: string | null) => void
}

interface TextPromptState {
  request: TextPromptRequest | null
}

export const useTextPromptStore = create<TextPromptState>(() => ({ request: null }))

/**
 * In-app replacement for `window.prompt()`, which Electron does not support
 * (it always returns null). Resolves with the entered text, or null when the
 * dialog is cancelled. Rendered by `TextPromptDialog`.
 */
export function askText(
  title: string,
  options: { label?: string; defaultValue?: string; placeholder?: string } = {}
): Promise<string | null> {
  return new Promise((resolve) => {
    // Only one prompt at a time: cancel any prompt that is still open
    useTextPromptStore.getState().request?.resolve(null)
    useTextPromptStore.setState({
      request: {
        title,
        label: options.label,
        defaultValue: options.defaultValue ?? '',
        placeholder: options.placeholder,
        resolve
      }
    })
  })
}

/** Settle the open prompt (null = cancelled) and close the dialog. */
export function settleTextPrompt(value: string | null): void {
  const { request } = useTextPromptStore.getState()
  if (!request) return
  useTextPromptStore.setState({ request: null })
  request.resolve(value)
}
