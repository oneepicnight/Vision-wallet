import { useEffect, useRef, useState } from 'react'
import { useMessageStore, Message, MessageType } from '../state/messages'

const TYPE_META: Record<MessageType, { icon: string; color: string; bg: string; border: string }> = {
  info:    { icon: 'ℹ️',  color: '#b4c8ff', bg: 'rgba(80,120,255,0.12)',   border: 'rgba(80,120,255,0.3)'  },
  pending: { icon: '⏳',  color: '#ffd97d', bg: 'rgba(255,210,80,0.12)',   border: 'rgba(255,210,80,0.35)' },
  success: { icon: '✅',  color: '#50e6a8', bg: 'rgba(40,200,120,0.12)',   border: 'rgba(40,200,120,0.35)' },
  error:   { icon: '❌',  color: '#ff6b6b', bg: 'rgba(255,80,80,0.12)',    border: 'rgba(255,80,80,0.35)'  },
}

function formatTime(ts: number) {
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export default function MessageCenter() {
  const { messages, unreadCount, markAllRead, clearAll } = useMessageStore()
  const [open, setOpen] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  // scroll to top (newest) when new messages arrive while open
  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = 0
    }
  }, [messages.length, open])

  const handleOpen = () => {
    setOpen(true)
    markAllRead()
  }

  const handleClose = () => setOpen(false)

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={open ? handleClose : handleOpen}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 18px',
          background: 'linear-gradient(135deg, rgba(30,40,90,0.95), rgba(60,30,100,0.95))',
          border: '1px solid rgba(100,150,255,0.5)',
          borderRadius: '50px',
          color: '#b4c8ff',
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer',
          boxShadow: '0 4px 24px rgba(0,0,0,0.5), 0 0 30px rgba(80,120,255,0.2)',
          backdropFilter: 'blur(12px)',
          transition: 'all 0.2s ease',
        }}
      >
        <span style={{ fontSize: '16px' }}>📬</span>
        <span>Activity</span>
        {unreadCount > 0 && (
          <span style={{
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            borderRadius: '50px',
            padding: '2px 8px',
            fontSize: '11px',
            fontWeight: 700,
            color: '#fff',
            minWidth: '20px',
            textAlign: 'center',
          }}>
            {unreadCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          style={{
            position: 'fixed',
            bottom: '80px',
            right: '24px',
            width: '380px',
            maxWidth: 'calc(100vw - 48px)',
            zIndex: 999,
            background: 'linear-gradient(160deg, rgba(10,14,40,0.97) 0%, rgba(20,10,50,0.97) 100%)',
            border: '1px solid rgba(100,150,255,0.3)',
            borderRadius: '20px',
            boxShadow: '0 8px 48px rgba(0,0,0,0.7), 0 0 60px rgba(80,120,255,0.15)',
            backdropFilter: 'blur(20px)',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '480px',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 20px 12px',
            borderBottom: '1px solid rgba(100,150,255,0.15)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>📬</span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#e0eaff' }}>Activity Log</span>
              <span style={{
                fontSize: '11px',
                color: '#5070a0',
                background: 'rgba(80,120,255,0.1)',
                padding: '2px 8px',
                borderRadius: '50px',
              }}>
                {messages.length} events
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {messages.length > 0 && (
                <button
                  onClick={clearAll}
                  style={{
                    background: 'none',
                    border: '1px solid rgba(100,150,255,0.3)',
                    borderRadius: '8px',
                    color: '#5070a0',
                    fontSize: '11px',
                    padding: '4px 10px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  Clear
                </button>
              )}
              <button
                onClick={handleClose}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#5070a0',
                  fontSize: '18px',
                  cursor: 'pointer',
                  lineHeight: 1,
                  padding: '2px 4px',
                }}
              >
                ×
              </button>
            </div>
          </div>

          {/* Message list */}
          <div
            ref={listRef}
            style={{
              overflowY: 'auto',
              flex: 1,
              padding: '12px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            {messages.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '40px 20px',
                color: '#3a4a70',
                fontSize: '13px',
              }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>🌌</div>
                No activity yet.<br />
                <span style={{ fontSize: '12px' }}>Send a transaction to see it here.</span>
              </div>
            ) : (
              messages.map((msg) => <MessageRow key={msg.id} msg={msg} />)
            )}
          </div>
        </div>
      )}
    </>
  )
}

function MessageRow({ msg }: { msg: Message }) {
  const meta = TYPE_META[msg.type]
  return (
    <div style={{
      background: meta.bg,
      border: `1px solid ${meta.border}`,
      borderRadius: '12px',
      padding: '10px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flex: 1 }}>
          <span style={{ fontSize: '13px', flexShrink: 0 }}>{meta.icon}</span>
          <span style={{ fontSize: '13px', color: meta.color, fontWeight: 500, lineHeight: 1.3 }}>
            {msg.text}
          </span>
        </div>
        <span style={{ fontSize: '10px', color: '#3a4a70', flexShrink: 0, marginTop: '2px' }}>
          {formatTime(msg.timestamp)}
        </span>
      </div>
      {msg.detail && (
        <div style={{
          fontSize: '11px',
          color: '#4a5a80',
          fontFamily: 'monospace',
          paddingLeft: '20px',
          wordBreak: 'break-all',
        }}>
          {msg.detail}
        </div>
      )}
    </div>
  )
}
