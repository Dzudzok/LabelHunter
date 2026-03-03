import { create } from 'zustand'
import { api } from '../services/api'

export const usePackageStore = create((set, get) => ({
  packages: [],
  loading: false,
  selectedDate: new Date().toISOString().split('T')[0],

  setSelectedDate: (date) => set({ selectedDate: date }),

  fetchPackages: async (date) => {
    set({ loading: true })
    try {
      const d = date || get().selectedDate
      const res = await api.get(`/packages?date=${d}`)
      set({ packages: res.data, loading: false })
    } catch (err) {
      set({ loading: false })
      console.error(err)
    }
  },

  importFromNextis: async (date = null, limit = null, dateFrom = null, dateTo = null) => {
    const params = new URLSearchParams()
    if (dateFrom && dateTo) {
      params.set('dateFrom', dateFrom)
      params.set('dateTo', dateTo)
    } else {
      const d = date || get().selectedDate
      if (d) {
        params.set('dateFrom', `${d}T00:00:00.000Z`)
        params.set('dateTo', `${d}T23:59:59.000Z`)
      }
    }
    if (limit) params.set('limit', limit)
    const res = await api.post(`/nextis/import?${params.toString()}`, null, { timeout: 90000 })
    return res.data
  },

  getPackageByInvoice: async (invoice) => {
    const res = await api.get(`/packages/by-invoice/${invoice}`)
    return res.data
  },

  updateItemScan: async (packageId, itemId, qty) => {
    const res = await api.put(`/packages/${packageId}/scan-item`, { itemId, qty })
    return res.data
  },

  skipAllItems: async (packageId) => {
    const res = await api.put(`/packages/${packageId}/skip-all`)
    return res.data
  },

  generateLabel: async (packageId, shipperCode = null, serviceCode = null) => {
    const body = {}
    if (shipperCode) body.shipperCode = shipperCode
    if (serviceCode) body.serviceCode = serviceCode
    const res = await api.post(`/packages/${packageId}/generate-label`, body)
    return res.data
  },

  updateStatus: async (packageId, status) => {
    const res = await api.put(`/packages/${packageId}/status`, { status })
    return res.data
  },
}))
