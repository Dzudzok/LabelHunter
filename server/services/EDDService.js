const supabase = require('../db/supabase');

/**
 * EDD (Expected Delivery Date) & Timeliness Service
 */
class EDDService {
  /**
   * Calculate expected delivery date for a delivery note.
   * Looks up edd_config for shipper_code + delivery_country (default CZ).
   * EDD = date_issued + business_days (skip weekends if count_weekends=false).
   */
  async calculateEDD(deliveryNote) {
    const shipperCode = deliveryNote.shipper_code;
    const countryCode = deliveryNote.delivery_country || 'CZ';

    if (!shipperCode || !deliveryNote.date_issued) return null;

    // Lookup config
    const { data: config } = await supabase
      .from('edd_config')
      .select('business_days, count_weekends')
      .eq('shipper_code', shipperCode)
      .eq('country_code', countryCode)
      .single();

    if (!config) {
      // Fallback: try with default CZ
      const { data: fallback } = await supabase
        .from('edd_config')
        .select('business_days, count_weekends')
        .eq('shipper_code', shipperCode)
        .eq('country_code', 'CZ')
        .single();

      if (!fallback) return null;
      return this._addDays(deliveryNote.date_issued, fallback.business_days, fallback.count_weekends);
    }

    return this._addDays(deliveryNote.date_issued, config.business_days, config.count_weekends);
  }

  /**
   * Add business_days to a start date, optionally skipping weekends.
   */
  _addDays(startDateStr, businessDays, countWeekends) {
    const date = new Date(startDateStr);
    if (isNaN(date.getTime())) return null;

    if (countWeekends) {
      date.setDate(date.getDate() + businessDays);
    } else {
      let added = 0;
      while (added < businessDays) {
        date.setDate(date.getDate() + 1);
        const dow = date.getDay();
        if (dow !== 0 && dow !== 6) {
          added++;
        }
      }
    }

    return date.toISOString().substring(0, 10);
  }

  /**
   * Calculate timeliness for a delivery note.
   * If delivered: compare delivered_at (last_tracking_update) with expected_delivery_date.
   * If not delivered: compare today with expected_delivery_date.
   */
  calculateTimeliness(deliveryNote) {
    const edd = deliveryNote.expected_delivery_date;
    if (!edd) return null;

    const eddDate = new Date(edd);
    const isDelivered = deliveryNote.unified_status === 'delivered';

    if (isDelivered) {
      const deliveredAt = deliveryNote.last_tracking_update || deliveryNote.delivered_at;
      if (!deliveredAt) return 'on_time'; // assume on time if no date

      const deliveredDate = new Date(deliveredAt);
      const deliveredDay = deliveredDate.toISOString().substring(0, 10);
      const eddDay = eddDate.toISOString().substring(0, 10);

      if (deliveredDay < eddDay) return 'early';
      if (deliveredDay === eddDay) return 'on_time';
      return 'late';
    } else {
      const today = new Date();
      const todayStr = today.toISOString().substring(0, 10);
      const eddStr = eddDate.toISOString().substring(0, 10);

      if (todayStr <= eddStr) return 'in_progress_on_time';
      return 'in_progress_late';
    }
  }

  /**
   * Calculate EDD + timeliness for a shipment and update in DB.
   * Accepts either an ID (string/number) or a delivery note object.
   */
  async updateEDDForShipment(deliveryNoteOrId) {
    let note;
    if (typeof deliveryNoteOrId === 'string' || typeof deliveryNoteOrId === 'number') {
      const { data, error } = await supabase
        .from('delivery_notes')
        .select('id, shipper_code, delivery_country, date_issued, unified_status, last_tracking_update, delivered_at, expected_delivery_date')
        .eq('id', deliveryNoteOrId)
        .single();
      if (error || !data) return null;
      note = data;
    } else {
      note = deliveryNoteOrId;
    }

    if (!note.id) return null;

    const edd = note.expected_delivery_date || await this.calculateEDD(note);
    if (!edd) return null;

    // Set EDD on note for timeliness calculation
    note.expected_delivery_date = edd;
    const timeliness = this.calculateTimeliness(note);

    const { error: updateErr } = await supabase
      .from('delivery_notes')
      .update({ expected_delivery_date: edd, timeliness })
      .eq('id', note.id);

    if (updateErr) {
      console.error('[EDDService] Update error:', updateErr.message);
      return null;
    }

    return { edd, timeliness };
  }

  /**
   * Batch update all shipments that have null expected_delivery_date and have a date_issued.
   * Processes in batches of 100.
   */
  async batchUpdateEDD() {
    let processed = 0;
    let offset = 0;
    const BATCH_SIZE = 100;

    while (true) {
      const { data: notes, error } = await supabase
        .from('delivery_notes')
        .select('id, shipper_code, delivery_country, date_issued, unified_status, last_tracking_update')
        .is('expected_delivery_date', null)
        .not('date_issued', 'is', null)
        .range(offset, offset + BATCH_SIZE - 1);

      if (error) {
        console.error('[EDDService] Batch fetch error:', error.message);
        break;
      }

      if (!notes || notes.length === 0) break;

      for (const note of notes) {
        const edd = await this.calculateEDD(note);
        if (!edd) continue;

        note.expected_delivery_date = edd;
        const timeliness = this.calculateTimeliness(note);

        await supabase
          .from('delivery_notes')
          .update({ expected_delivery_date: edd, timeliness })
          .eq('id', note.id);

        processed++;
      }

      if (notes.length < BATCH_SIZE) break;
      offset += BATCH_SIZE;
    }

    console.log(`[EDDService] Batch update complete: ${processed} shipments updated`);
    return processed;
  }
}

module.exports = new EDDService();
