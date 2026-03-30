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
    return { ...defaultFormData, ...JSON.parse(saved), uploadedImages: [], extraCostsReceipts: [] }
  } catch { return null }
}

const STEP_ICONS = [
  <svg key="1" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  <svg key="2" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>,
  <svg key="3" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
  <svg key="4" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" /></svg>,
  <svg key="5" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
]

function ReturnFormInner() {
  const { t } = useLang()
  const saved = loadSavedForm()
  const [step, setStep] = useState(saved ? saved._step || 1 : 1)
  const [formData, setFormData] = useState(saved || defaultFormData)
  const [result, setResult] = useState(null)

  useEffect(() => {
    if (result) { sessionStorage.removeItem(STORAGE_KEY); return }
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...formData, uploadedImages: [], extraCostsReceipts: [], _step: step })) } catch {}
  }, [formData, step, result])

  const updateForm = useCallback((updates) => setFormData(prev => ({ ...prev, ...updates })), [])
  const STEPS = [t('steps.verify'), t('steps.products'), t('steps.details'), t('steps.shipping'), t('steps.confirm')]

  if (result) {
    return (
      <PageWrapper hideSteps>
        <div className="max-w-md mx-auto text-center py-6 sm:py-10">
          <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center shadow-xl shadow-green-500/20 rotate-3">
            <svg className="w-12 h-12 text-white -rotate-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          </div>
          <h2 className="text-3xl font-black text-gray-900 mb-2">{t('result.title')}</h2>
          <div className="inline-block bg-gray-100 px-4 py-2 rounded-xl mb-6">
            <span className="text-sm text-gray-500">{t('result.number')}: </span>
            <span className="font-mono font-black text-[#1046A0] text-lg">{result.returnNumber}</span>
          </div>

          {result.shipment?.labelUrl && (
            <div className="mb-6 p-6 bg-white rounded-2xl border border-gray-100 shadow-sm">
              <div className="w-12 h-12 mx-auto mb-3 bg-red-100 rounded-2xl flex items-center justify-center">
                <svg className="w-6 h-6 text-[#D8112A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
              </div>
              <p className="text-sm text-gray-500 mb-4">{t('result.labelInfo')}</p>
              <a href={result.shipment.labelUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-[#D8112A] text-white px-8 py-3.5 rounded-2xl font-bold text-lg shadow-lg shadow-red-500/20 hover:shadow-red-500/30 hover:-translate-y-0.5 transition-all">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                {t('result.downloadLabel')}
              </a>
            </div>
          )}

          {result.shipment?.paymentUrl && !result.shipment?.labelUrl && (
            <div className="mb-6 p-6 bg-white rounded-2xl border border-gray-100 shadow-sm">
              <p className="text-sm text-gray-500 mb-2">{t('result.payInfo')}</p>
              <p className="text-3xl font-black text-gray-900 mb-4">{result.shipment.cost} <span className="text-lg">Kč</span></p>
              <a href={result.shipment.paymentUrl}
                className="inline-flex items-center gap-2 bg-emerald-500 text-white px-8 py-3.5 rounded-2xl font-bold shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 hover:-translate-y-0.5 transition-all">
                {t('result.payForLabel')}
              </a>
            </div>
          )}

          <a href={`/vraceni/stav/${result.accessToken}`}
            className="inline-flex items-center gap-2 text-[#1046A0] font-semibold hover:underline mt-2">
            {t('result.track')}
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
          </a>
        </div>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper>
      {/* Stepper */}
      <div className="mb-8 px-2">
        <div className="flex items-center justify-between max-w-lg mx-auto relative">
          {/* Connection line */}
          <div className="absolute top-5 left-[10%] right-[10%] h-[2px] bg-gray-200 z-0" />
          <div className="absolute top-5 left-[10%] h-[2px] bg-[#1046A0] z-0 transition-all duration-500"
            style={{ width: `${((step - 1) / (STEPS.length - 1)) * 80}%` }} />

          {STEPS.map((label, i) => (
            <div key={i} className="flex flex-col items-center relative z-10" style={{ width: `${100/STEPS.length}%` }}>
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                step > i + 1
                  ? 'bg-[#1046A0] text-white shadow-md shadow-blue-500/20'
                  : step === i + 1
                    ? 'bg-[#1046A0] text-white shadow-lg shadow-blue-500/30 scale-110'
                    : 'bg-white text-gray-300 border-2 border-gray-200'
              }`}>
                {step > i + 1 ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                ) : STEP_ICONS[i]}
              </div>
              <span className={`mt-2 text-[10px] font-semibold tracking-wide hidden sm:block ${
                step >= i + 1 ? 'text-[#1046A0]' : 'text-gray-400'
              }`}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {step === 1 && <Step1Verify formData={formData} updateForm={updateForm} onNext={() => setStep(2)} />}
      {step === 2 && <Step2Products formData={formData} updateForm={updateForm} onNext={() => setStep(3)} onBack={() => setStep(1)} />}
      {step === 3 && <Step3Details formData={formData} updateForm={updateForm} onNext={() => setStep(4)} onBack={() => setStep(2)} />}
      {step === 4 && <StepTransport formData={formData} updateForm={updateForm} onNext={() => setStep(5)} onBack={() => setStep(3)} />}
      {step === 5 && <Step4Confirm formData={formData} onBack={() => setStep(4)} onResult={setResult} />}
    </PageWrapper>
  )
}

export default function ReturnForm() {
  return <LangProvider><ReturnFormInner /></LangProvider>
}

function PageWrapper({ children, hideSteps }) {
  const { t } = useLang()
  return (
    <div className="min-h-screen" data-public-page>
      {/* Header */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a2d6e] via-[#1046A0] to-[#1a56b8]" />
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.4\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }} />
        <div className="relative max-w-2xl mx-auto px-4 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/Mroauto_1994.png" alt="MROAUTO" className="h-12 object-contain drop-shadow-lg" onError={(e) => { e.target.style.display = 'none' }} />
            <div>
              <div className="font-black text-xl text-white tracking-tight">MROAUTO</div>
              <div className="text-[11px] text-blue-200 font-medium">{t('header.subtitle')}</div>
            </div>
          </div>
          <LangSwitcher />
        </div>
        <div className="h-1.5 bg-gradient-to-r from-[#D8112A] via-[#ff3333] to-[#D8112A]" />
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="mt-16 py-6 text-center border-t border-gray-200/50">
        <p className="text-xs text-gray-400 font-medium">MROAUTO AUTODÍLY s.r.o. · www.mroauto.cz</p>
        <p className="text-[10px] text-gray-300 mt-1 font-semibold tracking-widest uppercase">Powered by RETURO</p>
      </footer>
    </div>
  )
}
