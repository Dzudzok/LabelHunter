const nodemailer = require('nodemailer');
const supabase = require('../db/supabase');

class TrackingEmailService {
  constructor() {
    const port = parseInt(process.env.SMTP_PORT, 10) || 587;
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
      tls: {
        rejectUnauthorized: false,
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
    });
  }

  // Status-to-method mapping and flag definitions
  static STATUS_CONFIG = {
    in_transit: {
      method: 'sendInTransitEmail',
      flag: 'email_in_transit_sent',
      emailType: 'in_transit',
    },
    available_for_pickup: {
      method: 'sendAvailableForPickupEmail',
      flag: 'email_pickup_sent',
      emailType: 'available_for_pickup',
    },
    delivered: {
      method: 'sendDeliveredEmail',
      flag: 'email_delivered_sent',
      emailType: 'delivered',
    },
    failed_delivery: {
      method: 'sendFailedDeliveryEmail',
      flag: 'email_failed_delivery_sent',
      emailType: 'failed_delivery',
    },
  };

  getFromAddress() {
    const name = process.env.SMTP_FROM_NAME || 'MROAUTO';
    const email = process.env.SMTP_FROM || 'info@mroauto.cz';
    return `"${name}" <${email}>`;
  }

  getRecipient(deliveryNote) {
    // Test mode: if SMTP_TEST_RECIPIENT is set, ALL emails go there instead of customers
    if (process.env.SMTP_TEST_RECIPIENT) {
      return process.env.SMTP_TEST_RECIPIENT;
    }
    return deliveryNote.customer_email || deliveryNote.delivery_email || null;
  }

  getTrackingLink(deliveryNote) {
    const appUrl = process.env.APP_URL || '';
    return `${appUrl}/sledovani/${deliveryNote.tracking_token}`;
  }

  getCarrierName(deliveryNote) {
    return deliveryNote.transport_name || deliveryNote.shipper_code || 'Dopravce';
  }

  /**
   * Replace dynamic tags in text: [[order.code]], [[shipping.tracking_number]], etc.
   */
  replaceTags(text, deliveryNote) {
    if (!text) return text;
    const trackingLink = this.getTrackingLink(deliveryNote);
    const map = {
      '[[order.code]]': deliveryNote.order_number || deliveryNote.doc_number || '',
      '[[shipping.tracking_number]]': deliveryNote.tracking_number || '',
      '[[shipping.tracking_url]]': trackingLink,
      '[[shipping.carrier]]': this.getCarrierName(deliveryNote),
      '[[shipping.stored_until]]': deliveryNote.stored_until ? new Date(deliveryNote.stored_until).toLocaleDateString('cs-CZ') : '',
      '[[shipping.status]]': deliveryNote.unified_status || '',
      '[[customer.name]]': deliveryNote.customer_name || '',
      '[[customer.email]]': deliveryNote.customer_email || '',
      '[[customer.phone]]': deliveryNote.customer_phone || '',
      '[[company.name]]': process.env.SMTP_FROM_NAME || 'MROAUTO',
      '[[doc.number]]': deliveryNote.doc_number || '',
    };
    let result = text;
    for (const [tag, value] of Object.entries(map)) {
      result = result.split(tag).join(value);
    }
    return result;
  }

  // Base HTML template shared by all tracking emails
  buildEmailHtml({ statusIcon, statusTitle, statusSubtitle, mainMessage, deliveryNote }) {
    const trackingLink = this.getTrackingLink(deliveryNote);
    const carrierName = this.getCarrierName(deliveryNote);
    const trackingNumber = deliveryNote.tracking_number || deliveryNote.lp_barcode || '-';
    const docNumber = deliveryNote.doc_number || '-';
    const customerGreeting = deliveryNote.customer_name
      ? `, <strong>${deliveryNote.customer_name}</strong>`
      : '';

    return `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${statusTitle}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f4f4f7; font-family: Arial, Helvetica, sans-serif; -webkit-text-size-adjust: 100%; }
    .wrapper { width: 100%; background-color: #f4f4f7; padding: 20px 0; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .header { background-color: #1046A0; padding: 28px 30px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 22px; letter-spacing: 1px; font-weight: 700; }
    .header p { color: rgba(255,255,255,0.85); margin: 4px 0 0; font-size: 13px; }
    .status-section { text-align: center; padding: 30px 30px 10px; }
    .status-icon { font-size: 48px; margin-bottom: 10px; }
    .status-title { font-size: 20px; font-weight: 700; color: #1046A0; margin: 0 0 6px; }
    .status-subtitle { font-size: 14px; color: #666666; margin: 0; }
    .content { padding: 10px 30px 30px; color: #333333; line-height: 1.7; font-size: 15px; }
    .btn-wrap { text-align: center; margin: 28px 0; }
    .btn { display: inline-block; padding: 14px 36px; background-color: #D8112A; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 15px; }
    .details-box { background: #f8f9fb; border-left: 4px solid #1046A0; padding: 16px 18px; margin: 22px 0; border-radius: 0 6px 6px 0; }
    .details-box table { width: 100%; border-collapse: collapse; }
    .details-box td { padding: 4px 0; font-size: 14px; vertical-align: top; }
    .details-box td.label { color: #666666; width: 140px; font-weight: 600; }
    .details-box td.value { color: #333333; }
    .divider { border: none; border-top: 1px solid #eeeeee; margin: 24px 0; }
    .footer { background-color: #1046A0; padding: 22px 30px; text-align: center; color: rgba(255,255,255,0.7); font-size: 12px; line-height: 1.6; }
    .footer a { color: #ffffff; text-decoration: underline; }
    .accent { color: #D8112A; }
    @media only screen and (max-width: 620px) {
      .container { margin: 0 10px; }
      .content, .status-section { padding-left: 20px; padding-right: 20px; }
      .header { padding: 22px 20px; }
      .details-box { padding: 12px 14px; }
      .details-box td.label { width: 110px; }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1>MROAUTO AUTOD&Iacute;LY</h1>
        <p>Sledov&aacute;n&iacute; z&aacute;silky</p>
      </div>

      <div class="status-section">
        <div class="status-icon">${statusIcon}</div>
        <p class="status-title">${statusTitle}</p>
        <p class="status-subtitle">${statusSubtitle}</p>
      </div>

      <div class="content">
        <p>Dobr&yacute; den${customerGreeting},</p>
        ${mainMessage}

        <div class="details-box">
          <table>
            <tr>
              <td class="label">Dodac&iacute; list:</td>
              <td class="value">${docNumber}</td>
            </tr>
            <tr>
              <td class="label">Sledovac&iacute; &ccaron;&iacute;slo:</td>
              <td class="value">${trackingNumber}</td>
            </tr>
            <tr>
              <td class="label">Dopravce:</td>
              <td class="value">${carrierName}</td>
            </tr>
            ${deliveryNote.order_number ? `<tr>
              <td class="label">Objedn&aacute;vka:</td>
              <td class="value">${deliveryNote.order_number}</td>
            </tr>` : ''}
          </table>
        </div>

        <div class="btn-wrap">
          <a href="${trackingLink}" class="btn">Sledovat z&aacute;silku</a>
        </div>

        <hr class="divider">
        <p style="font-size:13px; color:#888888;">V p&rcaron;&iacute;pad&ecaron; dotaz&udblac; n&aacute;s nev&aacute;hejte kontaktovat na
          <a href="mailto:info@mroauto.cz" style="color:#1046A0;">info@mroauto.cz</a> nebo
          na tel. <strong>+420&nbsp;774&nbsp;917&nbsp;859</strong>.</p>
        <p>S pozdravem,<br><strong>T&yacute;m MROAUTO</strong></p>
      </div>

      <div class="footer">
        <p>MROAUTO AUTOD&Iacute;LY s.r.o.<br>
        &Ccaron;s. arm&aacute;dy 360, Pudlov, 735 51 Bohum&iacute;n<br>
        <a href="mailto:info@mroauto.cz">info@mroauto.cz</a> | +420 774 917 859</p>
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  // Log email send attempt to email_log table
  async logEmail(deliveryNoteId, emailType, recipient, subject, status) {
    try {
      await supabase.from('email_log').insert({
        delivery_note_id: deliveryNoteId,
        email_type: emailType,
        recipient,
        subject,
        status,
        sent_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[TrackingEmailService] Failed to log email:', err.message);
    }
  }

  // ---- Individual email methods ----

  async sendInTransitEmail(deliveryNote) {
    const subject = `Va\u0161e z\u00e1silka je na cest\u011b | ${deliveryNote.doc_number || ''}`;
    const recipient = this.getRecipient(deliveryNote);
    if (!recipient) {
      console.warn('[TrackingEmailService] No recipient for in_transit email, DN:', deliveryNote.id);
      return false;
    }

    const html = this.buildEmailHtml({
      statusIcon: '\uD83D\uDCE6',
      statusTitle: 'Va&scaron;e z&aacute;silka je na cest&ecaron;',
      statusSubtitle: 'Z&aacute;silka byla p&rcaron;ed&aacute;na dopravci a m&iacute;&rcaron;&iacute; k V&aacute;m.',
      mainMessage: `<p>Va&scaron;e z&aacute;silka byla &uacute;sp&ecaron;&scaron;n&ecaron; odesl&aacute;na a pr&aacute;v&ecaron; je na cest&ecaron;.
        O dal&scaron;&iacute;ch zm&ecaron;n&aacute;ch stavu V&aacute;s budeme informovat e-mailem.</p>`,
      deliveryNote,
    });

    try {
      await this.transporter.sendMail({
        from: this.getFromAddress(),
        to: recipient,
        subject,
        html,
      });
      await this.logEmail(deliveryNote.id, 'in_transit', recipient, subject, 'sent');
      console.log('[TrackingEmailService] in_transit email sent for DN:', deliveryNote.id);
      return true;
    } catch (err) {
      console.error('[TrackingEmailService] Failed to send in_transit email:', err.message);
      await this.logEmail(deliveryNote.id, 'in_transit', recipient, subject, 'failed');
      return false;
    }
  }

  async sendAvailableForPickupEmail(deliveryNote) {
    const subject = `Va\u0161e z\u00e1silka je p\u0159ipravena k vyzvednut\u00ed | ${deliveryNote.doc_number || ''}`;
    const recipient = this.getRecipient(deliveryNote);
    if (!recipient) {
      console.warn('[TrackingEmailService] No recipient for pickup email, DN:', deliveryNote.id);
      return false;
    }

    const html = this.buildEmailHtml({
      statusIcon: '\uD83D\uDCEC',
      statusTitle: 'P&rcaron;ipraveno k vyzvednut&iacute;',
      statusSubtitle: 'Va&scaron;e z&aacute;silka &ccaron;ek&aacute; na vyzvednut&iacute; na v&yacute;dejn&iacute;m m&iacute;st&ecaron;.',
      mainMessage: `<p>Va&scaron;e z&aacute;silka dorazila na v&yacute;dejn&iacute; m&iacute;sto a je p&rcaron;ipravena k vyzvednut&iacute;.
        Pros&iacute;m vyzvedn&ecaron;te si ji co nejd&rcaron;&iacute;ve.</p>`,
      deliveryNote,
    });

    try {
      await this.transporter.sendMail({
        from: this.getFromAddress(),
        to: recipient,
        subject,
        html,
      });
      await this.logEmail(deliveryNote.id, 'available_for_pickup', recipient, subject, 'sent');
      console.log('[TrackingEmailService] pickup email sent for DN:', deliveryNote.id);
      return true;
    } catch (err) {
      console.error('[TrackingEmailService] Failed to send pickup email:', err.message);
      await this.logEmail(deliveryNote.id, 'available_for_pickup', recipient, subject, 'failed');
      return false;
    }
  }

  async sendDeliveredEmail(deliveryNote) {
    const subject = `Va\u0161e z\u00e1silka byla doru\u010dena | ${deliveryNote.doc_number || ''}`;
    const recipient = this.getRecipient(deliveryNote);
    if (!recipient) {
      console.warn('[TrackingEmailService] No recipient for delivered email, DN:', deliveryNote.id);
      return false;
    }

    const html = this.buildEmailHtml({
      statusIcon: '\u2705',
      statusTitle: 'Z&aacute;silka byla doru&ccaron;ena',
      statusSubtitle: 'Va&scaron;e z&aacute;silka byla &uacute;sp&ecaron;&scaron;n&ecaron; doru&ccaron;ena.',
      mainMessage: `<p>Va&scaron;e z&aacute;silka byla &uacute;sp&ecaron;&scaron;n&ecaron; doru&ccaron;ena.
        D&ecaron;kujeme za V&aacute;&scaron; n&aacute;kup u MROAUTO a t&ecaron;&scaron;&iacute;me se na dal&scaron;&iacute; objedn&aacute;vku!</p>`,
      deliveryNote,
    });

    try {
      await this.transporter.sendMail({
        from: this.getFromAddress(),
        to: recipient,
        subject,
        html,
      });
      await this.logEmail(deliveryNote.id, 'delivered', recipient, subject, 'sent');
      console.log('[TrackingEmailService] delivered email sent for DN:', deliveryNote.id);
      return true;
    } catch (err) {
      console.error('[TrackingEmailService] Failed to send delivered email:', err.message);
      await this.logEmail(deliveryNote.id, 'delivered', recipient, subject, 'failed');
      return false;
    }
  }

  async sendFailedDeliveryEmail(deliveryNote) {
    const subject = `Nepoda\u0159ilo se doru\u010dit va\u0161i z\u00e1silku | ${deliveryNote.doc_number || ''}`;
    const recipient = this.getRecipient(deliveryNote);
    if (!recipient) {
      console.warn('[TrackingEmailService] No recipient for failed_delivery email, DN:', deliveryNote.id);
      return false;
    }

    const html = this.buildEmailHtml({
      statusIcon: '\u26A0\uFE0F',
      statusTitle: 'Doru&ccaron;en&iacute; se nezda&rcaron;ilo',
      statusSubtitle: 'Dopravci se nepoda&rcaron;ilo doru&ccaron;it Va&scaron;i z&aacute;silku.',
      mainMessage: `<p>Bohu&zcaron;el se nepoda&rcaron;ilo doru&ccaron;it Va&scaron;i z&aacute;silku.
        Dopravce se pokus&iacute; o op&ecaron;tovn&eacute; doru&ccaron;en&iacute; nebo bude z&aacute;silka p&rcaron;ipravena k vyzvednut&iacute;
        na nejbli&zcaron;&scaron;&iacute;m v&yacute;dejn&iacute;m m&iacute;st&ecaron;. Sledujte stav z&aacute;silky pro aktu&aacute;ln&iacute; informace.</p>`,
      deliveryNote,
    });

    try {
      await this.transporter.sendMail({
        from: this.getFromAddress(),
        to: recipient,
        subject,
        html,
      });
      await this.logEmail(deliveryNote.id, 'failed_delivery', recipient, subject, 'sent');
      console.log('[TrackingEmailService] failed_delivery email sent for DN:', deliveryNote.id);
      return true;
    } catch (err) {
      console.error('[TrackingEmailService] Failed to send failed_delivery email:', err.message);
      await this.logEmail(deliveryNote.id, 'failed_delivery', recipient, subject, 'failed');
      return false;
    }
  }

  // ---- Main orchestrator ----

  async processStatusChange(deliveryNote, newStatus, oldStatus) {
    const config = TrackingEmailService.STATUS_CONFIG[newStatus];
    if (!config) {
      // No email configured for this status
      return false;
    }

    // Check if this email was already sent (duplicate guard)
    if (deliveryNote[config.flag] === true) {
      console.log(`[TrackingEmailService] Email "${config.emailType}" already sent for DN: ${deliveryNote.id}, skipping.`);
      return false;
    }

    // Verify we have a tracking token for the link
    if (!deliveryNote.tracking_token) {
      console.warn(`[TrackingEmailService] No tracking_token for DN: ${deliveryNote.id}, skipping email.`);
      return false;
    }

    // Send the appropriate email
    const success = await this[config.method](deliveryNote);

    if (success) {
      // Update the flag on delivery_notes to prevent duplicate sends
      try {
        await supabase
          .from('delivery_notes')
          .update({ [config.flag]: true })
          .eq('id', deliveryNote.id);
      } catch (err) {
        console.error(`[TrackingEmailService] Failed to update flag ${config.flag} for DN: ${deliveryNote.id}`, err.message);
      }
    }

    return success;
  }

  // ---- Transactional emails (order events) ----

  async sendOrderConfirmedEmail(deliveryNote) {
    const subject = this.replaceTags('Potvrzení objednávky [[order.code]]', deliveryNote);
    const recipient = this.getRecipient(deliveryNote);
    if (!recipient) return false;

    const html = this.buildEmailHtml({
      statusIcon: '\uD83D\uDED2',
      statusTitle: 'Objedn&aacute;vka potvrzena',
      statusSubtitle: 'Va&scaron;e objedn&aacute;vka byla p&rcaron;ijata ke zpracov&aacute;n&iacute;.',
      mainMessage: `<p>D&ecaron;kujeme za Va&scaron;i objedn&aacute;vku! Objedn&aacute;vka <strong>${deliveryNote.order_number || deliveryNote.doc_number || ''}</strong>
        byla &uacute;sp&ecaron;&scaron;n&ecaron; p&rcaron;ijata a bude co nejd&rcaron;&iacute;ve zpracov&aacute;na.</p>`,
      deliveryNote,
    });

    try {
      await this.transporter.sendMail({ from: this.getFromAddress(), to: recipient, subject, html });
      await this.logEmail(deliveryNote.id, 'order_confirmed', recipient, subject, 'sent');
      return true;
    } catch (err) {
      console.error('[TrackingEmailService] order_confirmed error:', err.message);
      await this.logEmail(deliveryNote.id, 'order_confirmed', recipient, subject, 'failed');
      return false;
    }
  }

  async sendOrderShippedEmail(deliveryNote) {
    const subject = this.replaceTags('Objednávka [[order.code]] byla odeslána', deliveryNote);
    const recipient = this.getRecipient(deliveryNote);
    if (!recipient) return false;

    const html = this.buildEmailHtml({
      statusIcon: '\uD83D\uDCE6',
      statusTitle: 'Objedn&aacute;vka odesl&aacute;na',
      statusSubtitle: 'Va&scaron;e objedn&aacute;vka byla p&rcaron;ed&aacute;na dopravci.',
      mainMessage: `<p>Va&scaron;e objedn&aacute;vka byla odesl&aacute;na dopravcem <strong>${this.getCarrierName(deliveryNote)}</strong>.
        Sledujte stav z&aacute;silky na odkazu n&iacute;&zcaron;e.</p>`,
      deliveryNote,
    });

    try {
      await this.transporter.sendMail({ from: this.getFromAddress(), to: recipient, subject, html });
      await this.logEmail(deliveryNote.id, 'order_shipped', recipient, subject, 'sent');
      return true;
    } catch (err) {
      console.error('[TrackingEmailService] order_shipped error:', err.message);
      await this.logEmail(deliveryNote.id, 'order_shipped', recipient, subject, 'failed');
      return false;
    }
  }
}

module.exports = new TrackingEmailService();
