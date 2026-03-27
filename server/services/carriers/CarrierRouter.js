/**
 * CarrierRouter — routes tracking requests to the correct carrier API.
 * Falls back to LP API if no direct integration is available/configured.
 */
const glsService = require('./GLSService');
const pplService = require('./PPLService');
const zasilkovnaService = require('./ZasilkovnaService');
const dpdService = require('./DPDService');
const upsService = require('./UPSService');
const inTimeService = require('./InTimeService');
const ceskaPostaService = require('./CeskaPostaService');

// Map shipper_code → carrier service
const CARRIER_MAP = {
  GLS: glsService,
  PPL: pplService,
  ZASILKOVNA: zasilkovnaService,
  Zasilkovna: zasilkovnaService,
  DPD: dpdService,
  UPS: upsService,
  INTIME: inTimeService,
  InTime: inTimeService,
  CP: ceskaPostaService,
};

class CarrierRouter {
  /**
   * Get carrier service for a shipper code.
   * Returns null if no direct integration available.
   */
  /**
   * Get carrier service for a shipper code.
   * Returns null if no direct integration available.
   * @param {string} shipperCode
   * @param {string} [trackingNumber] - needed for PPL to distinguish DHL vs domestic
   */
  getService(shipperCode, trackingNumber) {
    const service = CARRIER_MAP[shipperCode];
    if (!service) return null;

    // PPL: only PPL DHL (207...) works via CPL API. Domestic (707/457/407) needs LP API.
    if (shipperCode === 'PPL' && trackingNumber && !pplService.isPPLDHL(trackingNumber)) {
      return null;
    }

    // GLS and CP don't have isConfigured() — always available
    if (typeof service.isConfigured === 'function' && !service.isConfigured()) {
      return null;
    }

    return service;
  }

  /**
   * Check which carriers have direct API configured.
   */
  getConfiguredCarriers() {
    const result = {};
    for (const [code, service] of Object.entries(CARRIER_MAP)) {
      const configured = typeof service.isConfigured === 'function'
        ? service.isConfigured()
        : true; // GLS, CP are always configured
      result[code] = configured;
    }
    return result;
  }

  /**
   * Get tracking for any carrier by shipper code.
   * @param {string} shipperCode
   * @param {string} trackingNumber
   * @returns {object|null} { trackingNumber, statuses[] } or null if no service
   */
  async getTracking(shipperCode, trackingNumber) {
    const service = this.getService(shipperCode, trackingNumber);
    if (!service) return null;
    return service.getParcelStatuses(trackingNumber);
  }
}

module.exports = new CarrierRouter();
