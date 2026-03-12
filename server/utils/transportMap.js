const supabase = require('../db/supabase');

async function getTransportMap() {
  try {
    const { data, error } = await supabase
      .from('transport_map')
      .select('nextis_name, shipper_code, service_code, skip');
    if (error) throw error;
    const map = {};
    for (const row of (data || [])) {
      map[row.nextis_name] = { shipperCode: row.shipper_code, serviceCode: row.service_code, skip: row.skip || false };
    }
    return map;
  } catch (err) {
    console.error('[TransportMap] Failed to load from Supabase:', err.message);
    return {};
  }
}

async function getTransportMapRows() {
  try {
    const { data, error } = await supabase
      .from('transport_map')
      .select('nextis_name, shipper_code, service_code, skip')
      .order('id');
    if (error) throw error;
    return (data || []).map(r => ({
      nextisName: r.nextis_name,
      shipperCode: r.shipper_code,
      serviceCode: r.service_code,
      skip: r.skip || false,
    }));
  } catch (err) {
    console.error('[TransportMap] Failed to load rows:', err.message);
    return [];
  }
}

async function saveTransportMapRows(rows) {
  // Delete all existing rows and re-insert
  const { error: deleteError } = await supabase
    .from('transport_map')
    .delete()
    .neq('id', 0); // delete all rows

  if (deleteError) throw deleteError;

  if (rows.length === 0) return;

  const records = rows.map(r => ({
    nextis_name: r.nextisName || '',
    shipper_code: r.shipperCode || null,
    service_code: r.serviceCode || null,
    skip: r.skip || false,
  }));

  const { error: insertError } = await supabase
    .from('transport_map')
    .insert(records);

  if (insertError) throw insertError;
}

module.exports = { getTransportMap, getTransportMapRows, saveTransportMapRows };
