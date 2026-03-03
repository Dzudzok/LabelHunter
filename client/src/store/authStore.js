import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAuthStore = create(persist(
  (set) => ({
    worker: null,
    setWorker: (worker) => set({ worker }),
    logout: () => set({ worker: null }),
  }),
  { name: 'labelhunter-auth' }
))
