import { createContext, useContext, useState } from 'react'

const LangContext = createContext({ lang: 'cs', t: (k) => k })

const translations = {
  // === ReturnForm (main) ===
  'steps.verify': { cs: 'Ověření', en: 'Verification' },
  'steps.products': { cs: 'Produkty', en: 'Products' },
  'steps.details': { cs: 'Detaily', en: 'Details' },
  'steps.shipping': { cs: 'Doprava', en: 'Shipping' },
  'steps.confirm': { cs: 'Potvrzení', en: 'Confirmation' },
  'result.title': { cs: 'Žádost byla odeslána', en: 'Request has been submitted' },
  'result.number': { cs: 'Číslo žádosti', en: 'Request number' },
  'result.track': { cs: 'Sledovat stav žádosti', en: 'Track request status' },
  'result.downloadLabel': { cs: 'Stáhnout přepravní štítek (PDF)', en: 'Download shipping label (PDF)' },
  'result.labelInfo': { cs: 'Vytiskněte štítek a nalepte jej na balík před odesláním.', en: 'Print the label and attach it to your package before shipping.' },
  'result.payForLabel': { cs: 'Zaplatit za přepravní štítek', en: 'Pay for shipping label' },
  'result.payInfo': { cs: 'Po zaplacení se vygeneruje přepravní štítek ke stažení.', en: 'After payment, a shipping label will be generated for download.' },
  'result.payAmount': { cs: 'Částka', en: 'Amount' },
  'header.subtitle': { cs: 'Vrácení a reklamace zboží', en: 'Returns & complaints' },

  // === Step1Verify ===
  'verify.title': { cs: 'Ověření objednávky', en: 'Order verification' },
  'verify.desc': { cs: 'Zadejte číslo faktury nebo objednávky a e-mail použitý při nákupu.', en: 'Enter your invoice/order number and the email used for purchase.' },
  'verify.docLabel': { cs: 'Číslo dokladu (faktura / objednávka)', en: 'Document number (invoice / order)' },
  'verify.docPlaceholder': { cs: 'např. 47193126', en: 'e.g. 47193126' },
  'verify.emailLabel': { cs: 'E-mail', en: 'Email' },
  'verify.emailPlaceholder': { cs: 'vas@email.cz', en: 'your@email.com' },
  'verify.error.empty': { cs: 'Vyplňte číslo dokladu a e-mail', en: 'Please fill in document number and email' },
  'verify.error.notFound': { cs: 'Objednávka nenalezena nebo e-mail neodpovídá', en: 'Order not found or email does not match' },
  'verify.loading': { cs: 'Ověřuji...', en: 'Verifying...' },
  'verify.submit': { cs: 'Ověřit objednávku', en: 'Verify order' },

  // === Step2Products ===
  'products.title': { cs: 'Vyberte produkty k vrácení', en: 'Select products to return' },
  'products.order': { cs: 'Objednávka', en: 'Order' },
  'products.qtyLabel': { cs: 'Počet k vrácení:', en: 'Quantity to return:' },
  'products.of': { cs: 'z', en: 'of' },

  // === Step3Details ===
  'details.title': { cs: 'Detaily žádosti', en: 'Request details' },
  'details.typeLabel': { cs: 'Typ žádosti', en: 'Request type' },
  'details.type.return': { cs: 'Vrácení', en: 'Return' },
  'details.type.complaint': { cs: 'Reklamace', en: 'Complaint' },
  'details.type.warranty': { cs: 'Záruka', en: 'Warranty' },
  'details.reasonLabel': { cs: 'Důvod', en: 'Reason' },
  'details.reasonPlaceholder': { cs: 'Vyberte důvod...', en: 'Select reason...' },
  'details.vehicleLabel': { cs: 'Vozidlo (model, rok, motor)', en: 'Vehicle (model, year, engine)' },
  'details.vehiclePlaceholder': { cs: 'např. Škoda Octavia 2019 1.6 TDI', en: 'e.g. Škoda Octavia 2019 1.6 TDI' },
  'details.vinLabel': { cs: 'VIN číslo', en: 'VIN number' },
  'details.vinRequired': { cs: 'VIN je povinné u reklamace', en: 'VIN is required for complaints' },
  'details.vinOptional': { cs: 'nepovinné', en: 'optional' },
  'details.vinPlaceholder': { cs: 'např. TMBAG7NE6J0123456', en: 'e.g. TMBAG7NE6J0123456' },
  'details.workshopTitle': { cs: 'Montážní dílna', en: 'Workshop' },
  'details.workshopDesc': { cs: 'Uveďte údaje o dílně, kde byl díl namontován', en: 'Provide details of the workshop where the part was installed' },
  'details.workshopName': { cs: 'Název dílny', en: 'Workshop name' },
  'details.workshopAddress': { cs: 'Adresa dílny', en: 'Workshop address' },
  'details.mountedLabel': { cs: 'Díl byl namontován na vozidle', en: 'Part was installed on vehicle' },
  'details.mountedWarning': { cs: 'Namontované díly nelze vrátit v rámci běžného vrácení. Můžete podat reklamaci.', en: 'Installed parts cannot be returned as a regular return. You can file a complaint.' },
  'details.descLabel': { cs: 'Podrobný popis', en: 'Detailed description' },
  'details.descPlaceholder': { cs: 'Popište problém podrobněji...', en: 'Describe the problem in detail...' },
  'details.extraCostsTitle': { cs: 'Dodatečné náklady', en: 'Additional costs' },
  'details.extraCostsDesc': { cs: 'Pokud jste měli další náklady spojené s reklamací (montáž, demontáž, diagnostika), přiložte doklady.', en: 'If you had additional costs related to the complaint (installation, removal, diagnostics), attach the documents.' },
  'details.extraCostsPlaceholder': { cs: 'Popis nákladů (např. demontáž vadného dílu)', en: 'Cost description (e.g. removal of defective part)' },
  'details.extraCostsAmount': { cs: 'Částka (CZK)', en: 'Amount (CZK)' },
  'details.extraCostsAttach': { cs: 'Přiložit doklady', en: 'Attach documents' },
  'details.photosLabel': { cs: 'Fotografie', en: 'Photos' },
  'details.photosRequired': { cs: 'min. {n} povinné', en: 'min. {n} required' },
  'details.phoneLabel': { cs: 'Telefon', en: 'Phone' },
  'details.bankLabel': { cs: 'Číslo bankovního účtu', en: 'Bank account number' },
  'details.bankPlaceholder': { cs: 'např. 123456789/0100 nebo IBAN', en: 'e.g. 123456789/0100 or IBAN' },
  'details.bankHint': { cs: 'Na tento účet bude zaslána refundace', en: 'Refund will be sent to this account' },
  'details.bankRequired': { cs: 'Číslo účtu je povinné', en: 'Bank account number is required' },

  // === StepTransport ===
  'transport.title': { cs: 'Jak chcete odeslat zboží zpět?', en: 'How would you like to send the goods back?' },
  'transport.desc': { cs: 'Vyberte způsob vrácení zboží.', en: 'Choose a return shipping method.' },
  'transport.zasilkovna': { cs: 'Zásilkovna — výdejní místo', en: 'Zásilkovna — drop-off point' },
  'transport.zasilkovnaDesc': { cs: 'Odevzdejte balík na zvoleném výdejním místě Zásilkovny', en: 'Drop off the package at a selected Zásilkovna point' },
  'transport.gls': { cs: 'GLS — výdejní místo', en: 'GLS — drop-off point' },
  'transport.glsDesc': { cs: 'Odevzdejte balík v bodě GLS ParcelShop', en: 'Drop off the package at a GLS ParcelShop' },
  'transport.self': { cs: 'Vlastní doprava', en: 'Self-ship' },
  'transport.selfDesc': { cs: 'Odešlete balík na vlastní náklady vlastním dopravcem', en: 'Ship the package at your own expense via your own carrier' },
  'transport.free': { cs: 'Zdarma', en: 'Free' },
  'transport.pickupPoint': { cs: 'Výdejní místo Zásilkovny', en: 'Zásilkovna pickup point' },
  'transport.selectPoint': { cs: 'Vybrat místo', en: 'Select point' },
  'transport.changePoint': { cs: 'Změnit', en: 'Change' },
  'transport.selectPointHint': { cs: 'Zvolte výdejní místo kliknutím na tlačítko výše', en: 'Select a pickup point by clicking the button above' },
  'transport.glsInfo': { cs: 'Po odeslání žádosti obdržíte štítek k vytisknutí. Odevzdejte balík v libovolném bodě GLS ParcelShop.', en: 'After submitting your request, you will receive a label to print. Drop off the package at any GLS ParcelShop.' },
  'transport.selfInfo': { cs: 'Adresa pro zaslání:', en: 'Shipping address:' },
  'transport.selfAddress': { cs: 'Reklamační oddělení, Čs. armády 360, 735 51 Bohumín', en: 'Returns Department, Čs. armády 360, 735 51 Bohumín' },

  // === Step4Confirm ===
  'confirm.title': { cs: 'Shrnutí žádosti', en: 'Request summary' },
  'confirm.order': { cs: 'Objednávka', en: 'Order' },
  'confirm.type': { cs: 'Typ', en: 'Type' },
  'confirm.reason': { cs: 'Důvod', en: 'Reason' },
  'confirm.products': { cs: 'Produkty k vrácení:', en: 'Products to return:' },
  'confirm.vin': { cs: 'VIN', en: 'VIN' },
  'confirm.workshop': { cs: 'Montážní dílna', en: 'Workshop' },
  'confirm.extraCosts': { cs: 'Dodatečné náklady', en: 'Additional costs' },
  'confirm.documents': { cs: 'Doklady', en: 'Documents' },
  'confirm.files': { cs: 'soubor(ů)', en: 'file(s)' },
  'confirm.desc': { cs: 'Popis', en: 'Description' },
  'confirm.vehicle': { cs: 'Vozidlo', en: 'Vehicle' },
  'confirm.photos': { cs: 'Fotografie', en: 'Photos' },
  'confirm.shipping': { cs: 'Zpětná doprava', en: 'Return shipping' },
  'confirm.bankAccount': { cs: 'Bankovní účet pro refundaci', en: 'Bank account for refund' },
  'confirm.contact': { cs: 'Kontakt', en: 'Contact' },
  'confirm.error': { cs: 'Nepodařilo se odeslat žádost', en: 'Failed to submit request' },
  'confirm.submitting': { cs: 'Odesílám...', en: 'Submitting...' },
  'confirm.submit': { cs: 'Odeslat žádost', en: 'Submit request' },

  // === Common ===
  'common.back': { cs: 'Zpět', en: 'Back' },
  'common.continue': { cs: 'Pokračovat', en: 'Continue' },
  'common.required': { cs: 'povinné', en: 'required' },
  'common.optional': { cs: 'nepovinné', en: 'optional' },
}

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem('returo_lang') || 'cs' } catch { return 'cs' }
  })

  const switchLang = (l) => {
    setLang(l)
    try { localStorage.setItem('returo_lang', l) } catch {}
  }

  const t = (key, params) => {
    const entry = translations[key]
    if (!entry) return key
    let text = entry[lang] || entry.cs || key
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(`{${k}}`, v)
      }
    }
    return text
  }

  return (
    <LangContext.Provider value={{ lang, setLang: switchLang, t }}>
      {children}
    </LangContext.Provider>
  )
}

export function useLang() {
  return useContext(LangContext)
}

export function LangSwitcher() {
  const { lang, setLang } = useLang()
  return (
    <div className="flex gap-1 bg-white/20 rounded-lg p-0.5">
      <button
        onClick={() => setLang('cs')}
        className={`px-2 py-0.5 rounded text-xs font-semibold transition-colors ${
          lang === 'cs' ? 'bg-white text-[#1046A0]' : 'text-white/80 hover:text-white'
        }`}
      >
        CZ
      </button>
      <button
        onClick={() => setLang('en')}
        className={`px-2 py-0.5 rounded text-xs font-semibold transition-colors ${
          lang === 'en' ? 'bg-white text-[#1046A0]' : 'text-white/80 hover:text-white'
        }`}
      >
        EN
      </button>
    </div>
  )
}
