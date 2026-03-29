const axios = require('axios');
const supabase = require('../db/supabase');

/**
 * Service for extending storage period at carrier pickup points.
 * Currently supports: Zásilkovna/Packeta, Česká Pošta
 */
class StorageExtensionService {
  constructor() {
    this.zasilkovnaPassword = process.env.ZASILKOVNA_API_PASSWORD || '952a8476660123c8';
    this.zasilkovnaUrl = 'https://www.zasilkovna.cz/api/rest';
  }

  /**
   * Extend storage for a shipment. Delegates to carrier-specific method.
   * @param {object} deliveryNote - full delivery_notes row
   * @returns {{ success, message, newStoredUntil? }}
   */
  async extendStorage(deliveryNote) {
    const carrier = deliveryNote.shipper_code;

    if (carrier === 'Zasilkovna' || carrier === 'ZASILKOVNA') {
      return this.extendZasilkovna(deliveryNote);
    }
    if (carrier === 'CP') {
      return this.extendCeskaPosta(deliveryNote);
    }

    return { success: false, message: `Prodloužení úložní doby není podporováno pro dopravce ${carrier}` };
  }

  /**
   * Zásilkovna — extend storage via packetAttributeChange API.
   * Standard pickup points: up to +14 days (max 21 total)
   * Z-Boxy: +1 day only
   */
  async extendZasilkovna(deliveryNote) {
    if (!this.zasilkovnaPassword) {
      return { success: false, message: 'Zásilkovna API not configured' };
    }

    const packetId = deliveryNote.tracking_number;
    if (!packetId) {
      return { success: false, message: 'Chybí tracking number' };
    }

    // Request 7 more days (Zásilkovna will cap at their maximum)
    const additionalDays = 7;

    const xmlBody = `<packetAttributeChange>
  <apiPassword>${this.zasilkovnaPassword}</apiPassword>
  <packetId>${packetId}</packetId>
  <storedUntil>${this._futureDate(additionalDays)}</storedUntil>
</packetAttributeChange>`;

    try {
      const res = await axios.post(this.zasilkovnaUrl, xmlBody, {
        headers: { 'Content-Type': 'text/xml' },
        timeout: 15000,
      });

      const responseText = res.data || '';
      const isError = responseText.includes('<fault>') || responseText.includes('<error>');

      if (isError) {
        const faultMsg = this._extractXml(responseText, 'faultString') || this._extractXml(responseText, 'message') || 'Unknown error';
        console.error(`[StorageExtension/Zasilkovna] Error for ${packetId}:`, faultMsg);
        return { success: false, message: `Zásilkovna: ${faultMsg}` };
      }

      // Update stored_until in DB
      const newDate = this._futureDate(additionalDays);
      await supabase
        .from('delivery_notes')
        .update({ stored_until: newDate })
        .eq('id', deliveryNote.id);

      console.log(`[StorageExtension/Zasilkovna] Extended storage for ${packetId} to ${newDate}`);
      return { success: true, message: `Úložní doba prodloužena do ${newDate}`, newStoredUntil: newDate };
    } catch (err) {
      console.error(`[StorageExtension/Zasilkovna] Request failed for ${packetId}:`, err.message);
      return { success: false, message: `Chyba komunikace: ${err.message}` };
    }
  }

  /**
   * Česká Pošta — extend storage.
   * CP allows one-time extension for max possible time.
   * Requires customer email in the system.
   * Uses public API: POST to CP extension endpoint.
   */
  async extendCeskaPosta(deliveryNote) {
    const trackingNumber = deliveryNote.tracking_number;
    if (!trackingNumber) {
      return { success: false, message: 'Chybí tracking number' };
    }

    const email = deliveryNote.customer_email;
    if (!email) {
      return { success: false, message: 'Česká pošta vyžaduje e-mail zákazníka pro prodloužení' };
    }

    try {
      // CP public API for storage extension
      const res = await axios.post('https://b2c.cpost.cz/services/ParcelService/v1/extendDeposit', {
        parcelCode: trackingNumber,
        email: email,
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000,
      });

      if (res.data?.resultCode === 0 || res.data?.success) {
        // Extend by 7 days (CP default max)
        const newDate = this._futureDate(7);
        await supabase
          .from('delivery_notes')
          .update({ stored_until: newDate })
          .eq('id', deliveryNote.id);

        console.log(`[StorageExtension/CP] Extended storage for ${trackingNumber}`);
        return { success: true, message: `Úložní doba u České pošty prodloužena`, newStoredUntil: newDate };
      }

      const errMsg = res.data?.resultText || res.data?.message || 'Neznámá chyba';
      return { success: false, message: `Česká pošta: ${errMsg}` };
    } catch (err) {
      console.error(`[StorageExtension/CP] Request failed for ${trackingNumber}:`, err.message);
      return { success: false, message: `Chyba komunikace: ${err.message}` };
    }
  }

  _futureDate(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  _extractXml(xml, tag) {
    const regex = new RegExp(`<${tag}>(.*?)</${tag}>`, 's');
    const match = xml.match(regex);
    return match ? match[1].trim() : null;
  }
}

module.exports = new StorageExtensionService();
