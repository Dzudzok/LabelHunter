import { useState, useEffect, useCallback } from 'react'
import Step1Verify from './Step1Verify'
import Step2Products from './Step2Products'
import Step3Details from './Step3Details'
import StepTransport from './StepTransport'
import Step4Confirm from './Step4Confirm'
import { LangProvider, useLang, LangSwitcher } from './i18n'

const STORAGE_KEY = 'returo_return_form'

const defaultFormData = {
  deliveryNote: null,
  items: [],
  selectedItems: [],
  type: 'return',
  reasonCode: '',
  reasonDetail: '',
  vehicleInfo: '',
  vin: '',
  workshopName: '',
  workshopAddress: '',
  extraCostsDescription: '',
  extraCostsAmount: '',
  extraCostsReceipts: [],
  wasMounted: false,
  customerName: '',
  customerEmail: '',
  customerPhone: '',
  bankAccount: '',
  uploadedImages: [],
  shippingOption: null,
  shippingMethod: null,
  shippingData: null,
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
    if (result) {
      sessionStorage.removeItem(STORAGE_KEY)
      return
    }
    try {
      const toSave = { ...formData, uploadedImages: [], extraCostsReceipts: [], _step: step }
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
    } catch {}
  }, [formData, step, result])

  const updateForm = useCallback((updates) => {
    setFormData(prev => ({ ...prev, ...updates }))
  }, [])

  const STEPS = [t('steps.verify'), t('steps.products'), t('steps.details'), t('steps.shipping'), t('steps.confirm')]

  if (result) {
    return (
      <PageWrapper>
        <div className="text-center py-12">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">{t('result.title')}</h2>
          <p className="text-gray-600 mb-4">{t('result.number')}: <strong>{result.returnNumber}</strong></p>
          <a
            href={`/vraceni/stav/${result.accessToken}`}
            className="inline-block bg-[#1046A0] text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity"
          >
            {t('result.track')}
          </a>
        </div>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper>
      <div className="flex items-center justify-center mb-8">
        {STEPS.map((label, i) => (
          <div key={i} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              step > i + 1 ? 'bg-green-500 text-white' :
              step === i + 1 ? 'bg-[#1046A0] text-white' :
              'bg-gray-200 text-gray-400'
            }`}>
              {step > i + 1 ? '✓' : i + 1}
            </div>
            <span className={`ml-1.5 text-sm ${step === i + 1 ? 'text-gray-800 font-semibold' : 'text-gray-400'} hidden sm:inline`}>
              {label}
            </span>
            {i < STEPS.length - 1 && <div className="w-8 sm:w-12 h-0.5 mx-2 bg-gray-200" />}
          </div>
        ))}
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
  return (
    <LangProvider>
      <ReturnFormInner />
    </LangProvider>
  )
}

function PageWrapper({ children }) {
  const { t } = useLang()
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#1046A0] text-white">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/Mroauto_1994.png" alt="MROAUTO" className="h-10 object-contain" onError={(e) => { e.target.style.display = 'none' }} />
            <div>
              <div className="font-bold text-lg">MROAUTO</div>
              <div className="text-xs opacity-80">{t('header.subtitle')}</div>
            </div>
          </div>
          <LangSwitcher />
        </div>
        <div className="h-1 bg-[#D8112A]" />
      </div>
      <div className="max-w-2xl mx-auto px-4 py-6">{children}</div>
      <div className="bg-gray-100 border-t mt-8 py-4 text-center text-xs text-gray-400">
        MROAUTO AUTODÍLY s.r.o. | www.mroauto.cz
      </div>
    </div>
  )
}
