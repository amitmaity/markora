import { useEffect, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useTextPromptStore, settleTextPrompt } from '../../services/textPrompt'

/**
 * Single-line text prompt (see `askText`). Mounted once at the layout level.
 */
export default function TextPromptDialog() {
  const request = useTextPromptStore((s) => s.request)
  const [value, setValue] = useState('')

  useEffect(() => {
    if (request) setValue(request.defaultValue)
  }, [request])

  return (
    <Dialog.Root
      open={request !== null}
      onOpenChange={(open) => {
        if (!open) settleTextPrompt(null)
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-[10000]"
          style={{ background: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(2px)' }}
        />
        <Dialog.Content
          className="fixed left-1/2 top-[22%] z-[10001] w-[420px] max-w-[calc(100vw-32px)] -translate-x-1/2 rounded-xl border shadow-2xl p-4"
          style={{
            background: 'var(--chrome-bg, #ffffff)',
            borderColor: 'var(--chrome-border, #e5e7eb)',
            color: 'var(--chrome-text, #111827)'
          }}
          aria-describedby={undefined}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault()
              settleTextPrompt(value)
            }}
          >
            <Dialog.Title className="text-sm font-semibold mb-3">{request?.title}</Dialog.Title>
            {request?.label && (
              <label htmlFor="text-prompt-input" className="block text-xs opacity-70 mb-1">
                {request.label}
              </label>
            )}
            <input
              id="text-prompt-input"
              type="text"
              autoFocus
              value={value}
              placeholder={request?.placeholder}
              onChange={(e) => setValue(e.target.value)}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full rounded-md border px-2.5 py-1.5 text-sm outline-none"
              style={{
                background: 'var(--editor-bg, #ffffff)',
                borderColor: 'var(--chrome-border, #d0d7de)',
                color: 'var(--text-color, #1f2328)'
              }}
            />
            <div className="flex justify-end gap-2 mt-4">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-md text-xs border hover:bg-black/5 cursor-pointer"
                  style={{ borderColor: 'var(--chrome-border, #d0d7de)', color: 'var(--chrome-text)' }}
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-md text-xs font-medium text-white cursor-pointer"
                style={{ background: 'var(--link-color, #0969da)' }}
              >
                OK
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
