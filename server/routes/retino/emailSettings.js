const express = require('express');
const router = express.Router();
const supabase = require('../../db/supabase');
const trackingEmailService = require('../../services/TrackingEmailService');

const sampleNote = {
  id: '00000000-0000-0000-0000-000000000000',
  doc_number: 'DL-2024-12345',
  tracking_number: 'GLS123456789',
  tracking_token: 'sample-token',
  customer_name: 'Jan Novák',
  customer_email: 'jan@example.com',
  shipper_code: 'GLS',
  order_number: 'OBJ-2024-001',
  transport_name: 'GLS',
};

// GET /templates — list all email templates
router.get('/templates', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .order('code');

    if (error) throw error;
    // Map DB column names to frontend expected names
    const mapped = (data || []).map(t => ({
      ...t,
      email_type: t.code,
      enabled: t.is_active,
    }));
    res.json(mapped);
  } catch (err) {
    console.error('[emailSettings] GET /templates error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /templates/:emailType — update template fields
router.patch('/templates/:emailType', async (req, res) => {
  try {
    const { emailType } = req.params;
    const { subject_template, heading, body_html, enabled } = req.body;

    const updates = {};
    if (subject_template !== undefined) updates.subject_template = subject_template;
    if (heading !== undefined) updates.heading = heading;
    if (body_html !== undefined) updates.body_html = body_html;
    if (enabled !== undefined) updates.is_active = enabled;
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('email_templates')
      .update(updates)
      .eq('code', emailType)
      .select()
      .single();

    if (error) throw error;
    res.json({ ...data, email_type: data.code, enabled: data.is_active });
  } catch (err) {
    console.error('[emailSettings] PATCH /templates error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /design — get email design settings (first/only row)
router.get('/design', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('email_design')
      .select('*')
      .limit(1)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('[emailSettings] GET /design error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /design — update email design fields
router.patch('/design', async (req, res) => {
  try {
    const {
      header_bg_color, header_text_color,
      button_bg_color, button_text_color,
      footer_bg_color, footer_text,
      company_name, company_subtitle,
      contact_email, contact_phone,
      logo_url,
    } = req.body;

    const updates = {};
    if (header_bg_color !== undefined) updates.header_bg_color = header_bg_color;
    if (header_text_color !== undefined) updates.header_text_color = header_text_color;
    if (button_bg_color !== undefined) updates.button_bg_color = button_bg_color;
    if (button_text_color !== undefined) updates.button_text_color = button_text_color;
    if (footer_bg_color !== undefined) updates.footer_bg_color = footer_bg_color;
    if (footer_text !== undefined) updates.footer_text = footer_text;
    if (company_name !== undefined) updates.company_name = company_name;
    if (company_subtitle !== undefined) updates.company_subtitle = company_subtitle;
    if (contact_email !== undefined) updates.contact_email = contact_email;
    if (contact_phone !== undefined) updates.contact_phone = contact_phone;
    if (logo_url !== undefined) updates.logo_url = logo_url;
    updates.updated_at = new Date().toISOString();

    // Get the first row's id to update
    const { data: existing } = await supabase
      .from('email_design')
      .select('id')
      .limit(1)
      .single();

    if (!existing) {
      return res.status(404).json({ error: 'No email_design row found' });
    }

    const { data, error } = await supabase
      .from('email_design')
      .update(updates)
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('[emailSettings] PATCH /design error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /preview — render HTML preview with sample data
router.post('/preview', async (req, res) => {
  try {
    const { email_type } = req.body;
    if (!email_type) {
      return res.status(400).json({ error: 'email_type is required' });
    }

    // Fetch the template
    const { data: template, error: tplError } = await supabase
      .from('email_templates')
      .select('*')
      .eq('code', email_type)
      .single();

    if (tplError) throw tplError;

    // Fetch design settings
    const { data: design } = await supabase
      .from('email_design')
      .select('*')
      .limit(1)
      .single();

    // Build preview HTML using the service's buildEmailHtml
    const statusIcons = {
      in_transit: '📦',
      available_for_pickup: '📬',
      delivered: '✅',
      failed_delivery: '⚠️',
      order_confirmed: '🛒',
      order_shipped: '🚚',
    };

    // Replace [[tags]] in subject and body
    const replaceTags = (text) => {
      if (!text) return text;
      return text
        .replace(/\[\[order\.code\]\]/g, sampleNote.order_number || sampleNote.doc_number)
        .replace(/\[\[shipping\.tracking_number\]\]/g, sampleNote.tracking_number)
        .replace(/\[\[shipping\.carrier\]\]/g, sampleNote.transport_name)
        .replace(/\[\[customer\.name\]\]/g, sampleNote.customer_name)
        .replace(/\[\[customer\.email\]\]/g, sampleNote.customer_email)
        .replace(/\[\[delivery_note\.doc_number\]\]/g, sampleNote.doc_number);
    };

    const resolvedSubject = replaceTags(template.subject_template);
    const resolvedBody = replaceTags(template.body_html);
    const resolvedHeading = replaceTags(template.heading);

    // Build HTML using design settings
    const d = design || {};
    const headerBg = d.header_bg_color || '#1046A0';
    const headerText = d.header_text_color || '#ffffff';
    const buttonBg = d.button_bg_color || '#D8112A';
    const buttonText = d.button_text_color || '#ffffff';
    const footerBg = d.footer_bg_color || '#1046A0';
    const footerTxt = (d.footer_text || 'MROAUTO AUTODÍLY s.r.o.').replace(/\n/g, '<br>');
    const companyName = d.company_name || 'MROAUTO AUTODÍLY';
    const companySubtitle = d.company_subtitle || 'Sledování zásilky';
    const contactEmail = d.contact_email || 'info@mroauto.cz';
    const contactPhone = d.contact_phone || '+420 774 917 859';

    const html = `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${resolvedSubject}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f4f4f7; font-family: Arial, Helvetica, sans-serif; }
    .wrapper { width: 100%; background-color: #f4f4f7; padding: 20px 0; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .header { background-color: ${headerBg}; padding: 28px 30px; text-align: center; }
    .header h1 { color: ${headerText}; margin: 0; font-size: 22px; letter-spacing: 1px; font-weight: 700; }
    .header p { color: ${headerText}; opacity: 0.85; margin: 4px 0 0; font-size: 13px; }
    .status-section { text-align: center; padding: 30px 30px 10px; }
    .status-icon { font-size: 48px; margin-bottom: 10px; }
    .status-title { font-size: 20px; font-weight: 700; color: ${headerBg}; margin: 0 0 6px; }
    .content { padding: 10px 30px 30px; color: #333333; line-height: 1.7; font-size: 15px; }
    .btn-wrap { text-align: center; margin: 28px 0; }
    .btn { display: inline-block; padding: 14px 36px; background-color: ${buttonBg}; color: ${buttonText}; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 15px; }
    .details-box { background: #f8f9fb; border-left: 4px solid ${headerBg}; padding: 16px 18px; margin: 22px 0; border-radius: 0 6px 6px 0; }
    .details-box table { width: 100%; border-collapse: collapse; }
    .details-box td { padding: 4px 0; font-size: 14px; vertical-align: top; }
    .details-box td.label { color: #666666; width: 140px; font-weight: 600; }
    .details-box td.value { color: #333333; }
    .divider { border: none; border-top: 1px solid #eeeeee; margin: 24px 0; }
    .footer { background-color: ${footerBg}; padding: 22px 30px; text-align: center; color: rgba(255,255,255,0.7); font-size: 12px; line-height: 1.6; }
    .footer a { color: #ffffff; text-decoration: underline; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1>${companyName}</h1>
        <p>${companySubtitle}</p>
      </div>

      <div class="status-section">
        <div class="status-icon">${statusIcons[email_type] || '📧'}</div>
        <p class="status-title">${resolvedHeading}</p>
      </div>

      <div class="content">
        <p>Dobrý den, <strong>${sampleNote.customer_name}</strong>,</p>
        ${resolvedBody}

        <div class="details-box">
          <table>
            <tr>
              <td class="label">Dodací list:</td>
              <td class="value">${sampleNote.doc_number}</td>
            </tr>
            <tr>
              <td class="label">Sledovací číslo:</td>
              <td class="value">${sampleNote.tracking_number}</td>
            </tr>
            <tr>
              <td class="label">Dopravce:</td>
              <td class="value">${sampleNote.transport_name}</td>
            </tr>
            <tr>
              <td class="label">Objednávka:</td>
              <td class="value">${sampleNote.order_number}</td>
            </tr>
          </table>
        </div>

        <div class="btn-wrap">
          <a href="#" class="btn">Sledovat zásilku</a>
        </div>

        <hr class="divider">
        <p style="font-size:13px; color:#888888;">V případě dotazů nás neváhejte kontaktovat na
          <a href="mailto:${contactEmail}" style="color:${headerBg};">${contactEmail}</a> nebo
          na tel. <strong>${contactPhone}</strong>.</p>
        <p>S pozdravem,<br><strong>Tým ${companyName}</strong></p>
      </div>

      <div class="footer">
        <p>${footerTxt}<br>
        <a href="mailto:${contactEmail}">${contactEmail}</a> | ${contactPhone}</p>
      </div>
    </div>
  </div>
</body>
</html>`;

    res.json({ html, subject: resolvedSubject });
  } catch (err) {
    console.error('[emailSettings] POST /preview error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /test — send a test email
router.post('/test', async (req, res) => {
  try {
    const { email_type, recipient } = req.body;
    if (!email_type || !recipient) {
      return res.status(400).json({ error: 'email_type and recipient are required' });
    }

    // Get preview HTML first
    const { data: template, error: tplError } = await supabase
      .from('email_templates')
      .select('*')
      .eq('code', email_type)
      .single();

    if (tplError) throw tplError;

    // Replace tags in subject
    const subject = (template.subject_template || '')
      .replace(/\[\[order\.code\]\]/g, sampleNote.order_number || sampleNote.doc_number)
      .replace(/\[\[shipping\.tracking_number\]\]/g, sampleNote.tracking_number)
      .replace(/\[\[shipping\.carrier\]\]/g, sampleNote.transport_name)
      .replace(/\[\[customer\.name\]\]/g, sampleNote.customer_name)
      .replace(/\[\[customer\.email\]\]/g, sampleNote.customer_email)
      .replace(/\[\[delivery_note\.doc_number\]\]/g, sampleNote.doc_number);

    // Use the status config mapping if available, otherwise use buildEmailHtml directly
    const statusIcons = {
      in_transit: '📦',
      available_for_pickup: '📬',
      delivered: '✅',
      failed_delivery: '⚠️',
      order_confirmed: '🛒',
      order_shipped: '🚚',
    };

    const replaceTags = (text) => {
      if (!text) return text;
      return text
        .replace(/\[\[order\.code\]\]/g, sampleNote.order_number || sampleNote.doc_number)
        .replace(/\[\[shipping\.tracking_number\]\]/g, sampleNote.tracking_number)
        .replace(/\[\[shipping\.carrier\]\]/g, sampleNote.transport_name)
        .replace(/\[\[customer\.name\]\]/g, sampleNote.customer_name)
        .replace(/\[\[customer\.email\]\]/g, sampleNote.customer_email)
        .replace(/\[\[delivery_note\.doc_number\]\]/g, sampleNote.doc_number);
    };

    const html = trackingEmailService.buildEmailHtml({
      statusIcon: statusIcons[email_type] || '📧',
      statusTitle: replaceTags(template.heading) || email_type,
      statusSubtitle: '',
      mainMessage: replaceTags(template.body_html) || '',
      deliveryNote: sampleNote,
    });

    await trackingEmailService.transporter.sendMail({
      from: trackingEmailService.getFromAddress(),
      to: recipient,
      subject: `[TEST] ${subject}`,
      html,
    });

    res.json({ success: true, message: `Test email sent to ${recipient}` });
  } catch (err) {
    console.error('[emailSettings] POST /test error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
