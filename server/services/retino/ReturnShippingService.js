const axios = require('axios');
const supabase = require('../../db/supabase');

/**
 * ReturnShippingService — zarządza transportem zwrotnym.
 * Obsługuje: Zásilkovna drop-off, courier pickup, self-ship.
 * Generuje etykiety Zásilkovna via createPacket API.
 */
class ReturnShippingService {
  constructor() {
    this.zasilkovnaApiPassword = process.env.ZASILKOVNA_API_PASSWORD || '';
    this.zasilkovnaBaseUrl = process.env.ZASILKOVNA_API_URL || 'https://www.zasilkovna.cz/api/rest';
  }

  /**
   * Create a return shipment record + generate label if applicable.
   */
  async createShipment({ returnId, carrier, shippingMethod, pickupPoint, customerAddress, notes }) {
    // Build shipment data
    const shipmentData = {
      return_id: returnId,
      carrier: carrier || 'self',
      shipping_method: shippingMethod || 'self_ship',
      status: 'pending',
      notes: notes || null,
    };

    if (pickupPoint) {
      shipmentData.pickup_point_id = pickupPoint.id || null;
      shipmentData.pickup_point_name = pickupPoint.name || null;
      shipmentData.pickup_point_address = pickupPoint.address || null;
    }

    if (customerAddress) {
      shipmentData.customer_address = customerAddress;
    }

    // Insert shipment
    const { data: shipment, error } = await supabase
      .from('return_shipments')
      .insert(shipmentData)
      .select()
      .single();

    if (error) throw error;

    // If Zásilkovna drop-off, generate label
    if (carrier === 'zasilkovna' && shippingMethod === 'drop_off') {
      try {
        const label = await this.createZasilkovnaPacket(returnId, shipment.id, pickupPoint, customerAddress);
        // Update shipment with label info
        const { data: updated } = await supabase
          .from('return_shipments')
          .update({
            tracking_number: label.packetId,
            label_url: label.labelUrl || null,
            label_data: label,
            status: 'label_generated',
          })
          .eq('id', shipment.id)
          .select()
          .single();

        return updated || shipment;
      } catch (labelErr) {
        console.error('[ReturnShipping] Zásilkovna label error:', labelErr.message);
        // Shipment created but label failed — admin can retry
        await supabase
          .from('return_shipments')
          .update({ notes: `Label generation failed: ${labelErr.message}` })
          .eq('id', shipment.id);
      }
    }

    return shipment;
  }

  /**
   * Create a Zásilkovna packet for return shipment.
   * Uses XML API: createPacket
   */
  async createZasilkovnaPacket(returnId, shipmentId, pickupPoint, customerAddress) {
    if (!this.zasilkovnaApiPassword) {
      throw new Error('ZASILKOVNA_API_PASSWORD not configured');
    }

    // Fetch return + customer info
    const { data: ret } = await supabase
      .from('returns')
      .select('return_number, customer_name, customer_email, customer_phone')
      .eq('id', returnId)
      .single();

    if (!ret) throw new Error('Return not found');

    const nameParts = (ret.customer_name || 'Zákazník').split(' ');
    const firstName = nameParts[0] || 'Zákazník';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Target branch = pickup point ID for drop-off
    const addressId = pickupPoint?.id || '';

    const xmlBody = `<createPacket>
  <apiPassword>${this.zasilkovnaApiPassword}</apiPassword>
  <packetAttributes>
    <number>${ret.return_number}-${shipmentId}</number>
    <name>${escapeXml(firstName)}</name>
    <surname>${escapeXml(lastName)}</surname>
    <email>${escapeXml(ret.customer_email || '')}</email>
    <phone>${escapeXml(ret.customer_phone || '')}</phone>
    <addressId>${escapeXml(addressId)}</addressId>
    <value>0</value>
    <weight>1</weight>
    <eshop>${escapeXml(process.env.ZASILKOVNA_ESHOP || 'MROAUTO')}</eshop>
  </packetAttributes>
</createPacket>`;

    const res = await axios.post(this.zasilkovnaBaseUrl, xmlBody, {
      headers: { 'Content-Type': 'text/xml' },
      timeout: 15000,
    });

    const xml = res.data;

    // Check for error
    const fault = xml.match(/<fault>([^<]*)<\/fault>/);
    const faultString = xml.match(/<faultString>([^<]*)<\/faultString>/);
    if (fault || faultString) {
      throw new Error(`Zásilkovna API error: ${faultString?.[1] || fault?.[1] || 'Unknown error'}`);
    }

    // Extract packet ID
    const packetId = xml.match(/<id>(\d+)<\/id>/)?.[1];
    if (!packetId) {
      throw new Error('Zásilkovna API: no packet ID in response');
    }

    // Label URL
    const labelUrl = `https://www.zasilkovna.cz/api/packetLabelPdf/${this.zasilkovnaApiPassword}/${packetId}/1`;

    return {
      packetId,
      labelUrl,
      raw: xml,
    };
  }

  /**
   * Get shipment(s) for a return.
   */
  async getShipmentsByReturn(returnId) {
    const { data, error } = await supabase
      .from('return_shipments')
      .select('*')
      .eq('return_id', returnId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Update shipment status.
   */
  async updateStatus(shipmentId, status, extras = {}) {
    const updates = { status, updated_at: new Date().toISOString(), ...extras };

    const { data, error } = await supabase
      .from('return_shipments')
      .update(updates)
      .eq('id', shipmentId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get shipping cost config (can be extended with carrier-specific pricing).
   */
  getShippingCost(carrier, shippingMethod) {
    // Default costs — can be moved to DB config later
    const costs = {
      zasilkovna: { drop_off: 89 },
      ppl: { courier_pickup: 149 },
      gls: { courier_pickup: 139 },
      cp: { drop_off: 99 },
      self: { self_ship: 0 },
    };

    return costs[carrier]?.[shippingMethod] || 0;
  }
}

function escapeXml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

module.exports = new ReturnShippingService();
