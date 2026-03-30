import { useState, useEffect, useCallback } from 'react'
import Step1Verify from './Step1Verify'
import Step2Products from './Step2Products'
import Step3Details from './Step3Details'
import StepTransport from './StepTransport'
import Step4Confirm from './Step4Confirm'
import { LangProvider, useLang, LangSwitcher } from './i18n'

const STORAGE_KEY = 'returo_return_form'

const defaultFormData = {
  deliveryNote: null, items: [], selectedItems: [], type: 'return',
  reasonCode: '', reasonDetail: '', vehicleInfo: '', vin: '',
  workshopName: '', workshopAddress: '', extraCostsDescription: '', extraCostsAmount: '',
  extraCostsReceipts: [], wasMounted: false,
  customerName: '', customerEmail: '', customerPhone: '', bankAccount: '',
  uploadedImages: [], shippingOption: null, shippingMethod: null, shippingData: null,
}

function loadSavedForm() {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY)
    if (!saved) return null
    const parsed = JSON.parse(saved)
    return { ...defaultFormData, ...parsed, uploadedImages: [], extraCostsReceipts: [] }
  } catch { return null }
}

function ReturnFormInner() {
  const { t } = useLang()
  const saved = loadSavedForm()
  const [step, setStep] = useState(saved ? saved._step || 1 : 1)
  const [formData, setFormData] = useState(saved || defaultFormData)
  const [result, setResult] = useState(null)

  useEffect(() => {
    if (result) { sessionStorage.removeItem(STORAGE_KEY); return }
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...formData, uploadedImages: [], extraCostsReceipts: [], _step: step }))
    } catch {}
  }, [formData, step, result])

  const updateForm = useCallback((updates) => setFormData(prev => ({ ...prev, ...updates })), [])

  const STEPS = [
    { label: t('steps.verify'), icon: '🔍' },
    { label: t('steps.products'), icon: '📦' },
    { label: t('steps.details'), icon: '📝' },
    { label: t('steps.shipping'), icon: '🚚' },
    { label: t('steps.confirm'), icon: '✅' },
  ]

  if (result) {
    return (
      <PageWrapper>
        <div className="max-w-md mx-auto text-center py-8">
          <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center shadow-lg shadow-green-200">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900 mb-1">{t('result.title')}</h2>
          <p className="text-gray-500 mb-2">{t('result.number')}</p>
          <p className="text-xl font-mono font-bold text-[#1046A0] mb-6 tracking-wide">{result.returnNumber}</p>

          {result.shipment?.labelUrl && (
            <div className="mb-5 p-5 bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-2xl">
              <p className="text-sm text-gray-600 mb-3">{t('result.labelInfo')}</p>
              <a href={result.shipment.labelUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-[#D8112A] to-[#B50E23] text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-red-200 hover:shadow-red-300 hover:scale-[1.02] transition-all">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                {t('result.downloadLabel')}
              </a>
            </div>
          )}

          {result.shipment?.paymentUrl && !result.shipment?.labelUrl && (
            <div className="mb-5 p-5 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl">
              <p className="text-sm text-gray-600 mb-2">{t('result.payInfo')}</p>
              <p className="text-2xl font-bold text-gray-900 mb-3">{result.shipment.cost} Kč</p>
              <a href={result.shipment.paymentUrl}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-green-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-green-200 hover:shadow-green-300 hover:scale-[1.02] transition-all">
                {t('result.payForLabel')}
              </a>
            </div>
          )}

          <a href={`/vraceni/stav/${result.accessToken}`}
            className="inline-flex items-center gap-2 bg-[#1046A0] text-white px-6 py-3 rounded-xl font-semibold hover:bg-[#0d3a85] transition-colors">
            {t('result.track')}
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </a>
        </div>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper>
      {/* Modern stepper */}
      <div className="mb-8">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          {STEPS.map((s, i) => (
            <div key={i} className="flex flex-col items-center relative" style={{ flex: 1 }}>
              {i > 0 && (
                <div className={`absolute top-5 right-1/2 w-full h-0.5 -translate-y-1/2 ${
                  step > i ? 'bg-gradient-to-r from-green-400 to-green-500' : 'bg-gray-200'
                }`} style={{ zIndex: 0 }} />
              )}
              <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                step > i + 1
                  ? 'bg-gradient-to-br from-green-400 to-emerald-500 text-white shadow-md shadow-green-200'
                  : step === i + 1
                    ? 'bg-gradient-to-br from-[#1046A0] to-[#0d3a85] text-white shadow-lg shadow-blue-200 scale-110'
                    : 'bg-gray-100 text-gray-400 border-2 border-gray-200'
              }`}>
                {step > i + 1 ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                ) : (
                  <span>{i + 1}</span>
                )}
              </div>
              <span className={`mt-1.5 text-[11px] font-medium hidden sm:block ${
                step === i + 1 ? 'text-[#1046A0] font-bold' : step > i + 1 ? 'text-green-600' : 'text-gray-400'
              }`}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="transition-all duration-300">
        {step === 1 && <Step1Verify formData={formData} updateForm={updateForm} onNext={() => setStep(2)} />}
        {step === 2 && <Step2Products formData={formData} updateForm={updateForm} onNext={() => setStep(3)} onBack={() => setStep(1)} />}
        {step === 3 && <Step3Details formData={formData} updateForm={updateForm} onNext={() => setStep(4)} onBack={() => setStep(2)} />}
        {step === 4 && <StepTransport formData={formData} updateForm={updateForm} onNext={() => setStep(5)} onBack={() => setStep(3)} />}
        {step === 5 && <Step4Confirm formData={formData} onBack={() => setStep(4)} onResult={setResult} />}
      </div>
    </PageWrapper>
  )
}

export default function ReturnForm() {
  return <LangProvider><ReturnFormInner /></LangProvider>
}

function PageWrapper({ children }) {
  const { t } = useLang()
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-gray-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#0d3a85] to-[#1046A0] text-white shadow-lg">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/Mroauto_1994.png" alt="MROAUTO" className="h-11 object-contain drop-shadow-md" onError={(e) => { e.target.style.display = 'none' }} />
            <div>
              <div className="font-extrabold text-lg tracking-tight">MROAUTO</div>
              <div className="text-[11px] text-blue-200">{t('header.subtitle')}</div>
            </div>
          </div>
          <LangSwitcher />
        </div>
        <div className="h-1 bg-gradient-to-r from-[#D8112A] via-[#ff4444] to-[#D8112A]" />
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        {children}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 mt-12 py-5 text-center">
        <p className="text-xs text-gray-400">MROAUTO AUTODÍLY s.r.o. | www.mroauto.cz</p>
        <p className="text-[10px] text-gray-300 mt-1">Powered by RETURO</p>
      </div>
    </div>
  )
}
