const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }

  getBaseStyles() {
    return `
      body { margin: 0; padding: 0; background-color: #f4f4f7; font-family: Arial, sans-serif; }
      .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
      .header { background-color: #1a2332; padding: 30px; text-align: center; }
      .header h1 { color: #f97316; margin: 0; font-size: 24px; }
      .header p { color: #ffffff; margin: 5px 0 0; font-size: 14px; }
      .content { padding: 30px; color: #333333; line-height: 1.6; }
      .btn { display: inline-block; padding: 14px 30px; background-color: #f97316; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; }
      .info-box { background: #f8f9fa; border-left: 4px solid #f97316; padding: 15px; margin: 20px 0; }
      .footer { background-color: #1a2332; padding: 20px; text-align: center; color: #999999; font-size: 12px; }
      .footer a { color: #f97316; text-decoration: none; }
      table.items { width: 100%; border-collapse: collapse; margin: 15px 0; }
      table.items th { background: #1a2332; color: #ffffff; padding: 8px 12px; text-align: left; font-size: 13px; }
      table.items td { padding: 8px 12px; border-bottom: 1px solid #eeeeee; font-size: 13px; }
    `;
  }

  async sendShipmentEmail(deliveryNote) {
    const appUrl = process.env.APP_URL || '';
    const trackingLink = `${appUrl}/tracking/${deliveryNote.tracking_token}`;

    const carrierName = deliveryNote.transport_name || deliveryNote.shipper_code || 'Dopravce';

    let itemsHtml = '';
    if (deliveryNote.items && deliveryNote.items.length > 0) {
      const rows = deliveryNote.items
        .filter(i => i.item_type === 'goods')
        .map(i => `<tr><td>${i.code || ''}</td><td>${i.text || ''}</td><td style="text-align:center">${i.qty}</td></tr>`)
        .join('');
      itemsHtml = `
        <h3 style="margin-top:25px;">Obsah zásilky:</h3>
        <table class="items">
          <thead><tr><th>Kód</th><th>Název</th><th>Ks</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    }

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>${this.getBaseStyles()}</style></head>
<body>
  <div class="container">
    <div class="header">
      <h1>MROAUTO AUTOD&Iacute;LY</h1>
      <p>Va&scaron;e z&aacute;silka byla odesl&aacute;na!</p>
    </div>
    <div class="content">
      <p>Dobr&yacute; den${deliveryNote.customer_name ? ', <strong>' + deliveryNote.customer_name + '</strong>' : ''},</p>
      <p>s radost&iacute; V&aacute;m oznamujeme, &zcaron;e Va&scaron;e z&aacute;silka byla odesl&aacute;na a je na cest&ecaron;!</p>

      <div class="info-box">
        <strong>Faktura:</strong> ${deliveryNote.invoice_number || '-'}<br>
        <strong>Objedn&aacute;vka:</strong> ${deliveryNote.order_number || '-'}<br>
        <strong>Dopravce:</strong> ${carrierName}<br>
        <strong>Sledovac&iacute; &ccaron;&iacute;slo:</strong> ${deliveryNote.tracking_number || deliveryNote.lp_barcode || '-'}
        ${deliveryNote.tracking_url ? '<br><a href="' + deliveryNote.tracking_url + '">Sledovat u dopravce</a>' : ''}
      </div>

      <p style="text-align:center; margin: 30px 0;">
        <a href="${trackingLink}" class="btn">Sledovat z&aacute;silku</a>
      </p>

      ${itemsHtml}

      <p style="margin-top:25px;">V p&rcaron;&iacute;pad&ecaron; dotaz&udblac; n&aacute;s nev&aacute;hejte kontaktovat.</p>
      <p>S pozdravem,<br><strong>T&yacute;m MROAUTO</strong></p>
    </div>
    <div class="footer">
      <p>MROAUTO AUTOD&Iacute;LY s.r.o. | &Ccaron;s. arm&aacute;dy 360, Pudlov, 735 51 Bohum&iacute;n</p>
      <p>Tel: +420 774 917 859 | <a href="mailto:info@mroauto.cz">info@mroauto.cz</a></p>
    </div>
  </div>
</body></html>`;

    await this.transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM}>`,
      to: deliveryNote.customer_email || deliveryNote.delivery_email,
      subject: `Vaše zásilka od MROAUTO byla odeslána! | Objednávka ${deliveryNote.order_number || ''}`,
      html,
    });
  }

  async sendProblemEmail(deliveryNote) {
    const appUrl = process.env.APP_URL || '';
    const trackingLink = `${appUrl}/tracking/${deliveryNote.tracking_token}`;

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>${this.getBaseStyles()}</style></head>
<body>
  <div class="container">
    <div class="header">
      <h1>MROAUTO AUTOD&Iacute;LY</h1>
      <p>Informace o Va&scaron;&iacute; z&aacute;silce</p>
    </div>
    <div class="content">
      <p>Dobr&yacute; den${deliveryNote.customer_name ? ', <strong>' + deliveryNote.customer_name + '</strong>' : ''},</p>
      <p>Va&scaron;e z&aacute;silka (faktura: <strong>${deliveryNote.invoice_number || '-'}</strong>) byla odesl&aacute;na p&rcaron;ed v&iacute;ce ne&zcaron; 3 pracovn&iacute;mi dny a zat&iacute;m nebyla doru&ccaron;ena.</p>
      <p>Pokud jste z&aacute;silku ji&zcaron; obdr&zcaron;eli, tento e-mail pros&iacute;m ignorujte. V opa&ccaron;n&eacute;m p&rcaron;&iacute;pad&ecaron; n&aacute;s pros&iacute;m kontaktujte.</p>

      <p style="text-align:center; margin: 30px 0;">
        <a href="${trackingLink}" class="btn">Sledovat z&aacute;silku</a>
      </p>

      <p>S pozdravem,<br><strong>T&yacute;m MROAUTO</strong></p>
    </div>
    <div class="footer">
      <p>MROAUTO AUTOD&Iacute;LY s.r.o. | &Ccaron;s. arm&aacute;dy 360, Pudlov, 735 51 Bohum&iacute;n</p>
      <p>Tel: +420 774 917 859 | <a href="mailto:info@mroauto.cz">info@mroauto.cz</a></p>
    </div>
  </div>
</body></html>`;

    await this.transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM}>`,
      to: deliveryNote.customer_email || deliveryNote.delivery_email,
      subject: `Informace o Vaší zásilce | Objednávka ${deliveryNote.order_number || ''}`,
      html,
    });
  }

  async sendContactFormEmail(deliveryNote, customerEmail, message) {
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>${this.getBaseStyles()}</style></head>
<body>
  <div class="container">
    <div class="header">
      <h1>MROAUTO AUTOD&Iacute;LY</h1>
      <p>Nov&aacute; zpr&aacute;va od z&aacute;kazn&iacute;ka</p>
    </div>
    <div class="content">
      <div class="info-box">
        <strong>Z&aacute;kazn&iacute;k:</strong> ${deliveryNote.customer_name || '-'}<br>
        <strong>E-mail:</strong> ${customerEmail}<br>
        <strong>Faktura:</strong> ${deliveryNote.invoice_number || '-'}<br>
        <strong>Dodac&iacute; list:</strong> ${deliveryNote.doc_number || '-'}
      </div>
      <h3>Zpr&aacute;va:</h3>
      <p style="background: #f8f9fa; padding: 15px; border-radius: 6px;">${message}</p>
    </div>
    <div class="footer">
      <p>Odesl&aacute;no z LabelHunter tracking str&aacute;nky</p>
    </div>
  </div>
</body></html>`;

    await this.transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM}>`,
      to: 'info@mroauto.cz',
      replyTo: customerEmail,
      subject: `Zpráva od zákazníka | Faktura ${deliveryNote.invoice_number || ''} | ${deliveryNote.customer_name || ''}`,
      html,
    });
  }
}

module.exports = new EmailService();
