const axios = require('axios');
const fs = require('fs');
const path = require('path');
const supabase = require('../../db/supabase');
const glsService = require('../carriers/GLSService');

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

    // If paid shipping (GLS, Zásilkovna) — don't generate label yet, wait for payment
    if (carrier !== 'self') {
      const cost = this.getShippingCost(carrier, shippingMethod);
      if (cost > 0) {
        // Build GoPay payment URL
        const goId = process.env.GOPAY_GOID || '8387806526';
        const goSecret = process.env.GOPAY_SECRET || '';
        const frontendUrl = process.env.FRONTEND_URL || 'https://returo.mroautoapp.cz';

        // Fetch access token for success URL
        const { data: ret } = await supabase
          .from('returns')
          .select('access_token')
          .eq('id', returnId)
          .single();

        const successUrl = `${frontendUrl}/vraceni/platba/${shipment.id}/${ret?.access_token || ''}?status=ok`;
        const failedUrl = `${frontendUrl}/vraceni/platba/${shipment.id}/${ret?.access_token || ''}?status=fail`;

        // GoPay payment button URL (simple redirect, no API needed)
        const paymentUrl = `https://gate.gopay.com/gw/pay-base-v2?` +
          `paymentCommand.targetGoId=${goId}` +
          `&paymentCommand.totalPrice=${cost * 100}` +
          `&paymentCommand.currency=CZK` +
          `&paymentCommand.productName=${encodeURIComponent('RETURO - zpětný štítek')}` +
          `&paymentCommand.orderNumber=${encodeURIComponent(`RET-${shipment.id}`)}` +
          `&paymentCommand.successURL=${encodeURIComponent(successUrl)}` +
          `&paymentCommand.failedURL=${encodeURIComponent(failedUrl)}` +
          (goSecret ? `&paymentCommand.encryptedSignature=${goSecret}` : '');

        // Update shipment with payment info
        await supabase
          .from('return_shipments')
          .update({
            status: 'pending_payment',
            payment_status: 'unpaid',
            cost,
            gopay_payment_url: paymentUrl,
          })
          .eq('id', shipment.id);

        shipment.status = 'pending_payment';
        shipment.cost = cost;
        shipment.gopay_payment_url = paymentUrl;
        return shipment;
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
   * Generate GLS return label via GLS MyGLS API directly.
   * Swaps sender/recipient — customer sends, MROAUTO receives.
   */
  async generateGLSLabel(returnId, shipmentId) {
    const { data: ret } = await supabase
      .from('returns')
      .select('return_number, customer_name, customer_email, customer_phone, delivery_note_id')
      .eq('id', returnId)
      .single();
    if (!ret) throw new Error('Return not found');

    const { data: dn } = await supabase
      .from('delivery_notes')
      .select('customer_name, customer_email, customer_phone, delivery_street, delivery_city, delivery_postal_code, delivery_country')
      .eq('id', ret.delivery_note_id)
      .single();

    const result = await glsService.printLabels({
      // Customer = sender (pickup)
      senderName: ret.customer_name || dn?.customer_name || '',
      senderStreet: dn?.delivery_street || '',
      senderCity: dn?.delivery_city || '',
      senderZip: dn?.delivery_postal_code || '',
      senderCountry: dn?.delivery_country || 'CZ',
      senderPhone: ret.customer_phone || dn?.customer_phone || '',
      senderEmail: ret.customer_email || dn?.customer_email || '',
      // MROAUTO = recipient (delivery)
      recipientName: 'MROAUTO AUTODÍLY s.r.o.',
      recipientStreet: 'Čs. armády 360, Pudlov',
      recipientCity: 'Bohumín',
      recipientZip: '73551',
      recipientCountry: 'CZ',
      recipientPhone: '+420774917859',
      recipientEmail: 'info@mroauto.cz',
      reference: `RET-${ret.return_number}`,
      weight: 1,
      count: 1,
    });

    const trackingNumber = result.parcelNumber ? String(result.parcelNumber) : null;

    // Store label base64 in DB, serve via API endpoint with full backend URL
    const apiBase = process.env.API_PUBLIC_URL || 'https://labelhunter-server.onrender.com';
    const labelUrl = result.labels ? `${apiBase}/api/retino/return-shipments/${shipmentId}/label.pdf` : null;

    return { trackingNumber, labelUrl, labelBase64: result.labels || null, parcelId: result.parcelId };
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
