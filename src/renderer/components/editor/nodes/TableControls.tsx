import React from 'react'
import {} from '@tiptap/react'
import {
  RowsIcon,
  Columns,
  Trash2,
  AlignLeft,
  AlignCenter,
  AlignRight
} from 'lucide-react'

interface Props {
  editor: any
}

export default function TableControls({ editor }: Props) {
  if (!editor) return null

  const btn = (label: string, icon: React.ReactNode, action: () => void, title?: string) => (
    <button
      onClick={action}
      title={title ?? label}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 8px',
        borderRadius: 4,
        border: '1px solid var(--chrome-border)',
        background: 'var(--editor-bg)',
        cursor: 'pointer',
        fontSize: 11,
        color: 'var(--text-color)',
        whiteSpace: 'nowrap'
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  )

  return (
    <div
      className="no-print"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 4,
        padding: '6px 8px',
        background: 'var(--chrome-bg)',
        borderBottom: '1px solid var(--chrome-border)',
        borderRadius: '6px 6px 0 0'
      }}
      contentEditable={false}
    >
      {btn('Row ↑', <RowsIcon size={12} />, () => editor.chain().focus().addRowBefore().run(), 'Add row above')}
      {btn('Row ↓', <RowsIcon size={12} />, () => editor.chain().focus().addRowAfter().run(), 'Add row below')}
      {btn('Col ←', <Columns size={12} />, () => editor.chain().focus().addColumnBefore().run(), 'Add column left')}
      {btn('Col →', <Columns size={12} />, () => editor.chain().focus().addColumnAfter().run(), 'Add column right')}
      <div style={{ width: 1, background: 'var(--chrome-border)', margin: '0 2px' }} />
      {btn('Del Row', <Trash2 size={12} />, () => editor.chain().focus().deleteRow().run())}
      {btn('Del Col', <Trash2 size={12} />, () => editor.chain().focus().deleteColumn().run())}
      {btn('Del Table', <Trash2 size={12} />, () => editor.chain().focus().deleteTable().run())}
      <div style={{ width: 1, background: 'var(--chrome-border)', margin: '0 2px' }} />
      {btn('', <AlignLeft size={12} />, () => editor.chain().focus().setCellAttribute('textAlign', 'left').run(), 'Align left')}
      {btn('', <AlignCenter size={12} />, () => editor.chain().focus().setCellAttribute('textAlign', 'center').run(), 'Align center')}
      {btn('', <AlignRight size={12} />, () => editor.chain().focus().setCellAttribute('textAlign', 'right').run(), 'Align right')}
    </div>
  )
}
