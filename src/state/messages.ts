import { create } from 'zustand'

export type MessageType = 'info' | 'pending' | 'success' | 'error'

export interface Message {
  id: string
  type: MessageType
  text: string
  detail?: string   // e.g. tx hash or error detail
  timestamp: number
  read: boolean
}

interface MessageState {
  messages: Message[]
  unreadCount: number
  addMessage: (type: MessageType, text: string, detail?: string) => string
  markAllRead: () => void
  clearAll: () => void
}

let _seq = 0

export const useMessageStore = create<MessageState>((set) => ({
  messages: [],
  unreadCount: 0,

  addMessage: (type, text, detail) => {
    const id = `msg-${Date.now()}-${_seq++}`
    const msg: Message = { id, type, text, detail, timestamp: Date.now(), read: false }
    set((s) => ({
      messages: [msg, ...s.messages].slice(0, 100), // keep latest 100
      unreadCount: s.unreadCount + 1,
    }))
    return id
  },

  markAllRead: () => {
    set((s) => ({
      messages: s.messages.map((m) => ({ ...m, read: true })),
      unreadCount: 0,
    }))
  },

  clearAll: () => set({ messages: [], unreadCount: 0 }),
}))
