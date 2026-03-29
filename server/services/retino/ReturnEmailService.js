const nodemailer = require('nodemailer');
const supabase = require('../../db/supabase');

/**
 * ReturnEmailService — wysyłanie emaili związanych ze zwrotami.
 * Korzysta z tabeli email_queue (retry logic) i email_templates (szablony).
 */
class ReturnEmailService {
  constructor() {
    const port = parseInt(process.env.SMTP_PORT, 10) || 587;
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
    });
  }

  getFromAddress() {
    const name = process.env.SMTP_FROM_NAME || 'MROAUTO';
    const email = process.env.SMTP_FROM || 'noreply@mroauto.cz';
    return `"${name}" <${email}>`;
  }

  getRecipient(ret) {
    if (process.env.SMTP_TEST_RECIPIENT) return process.env.SMTP_TEST_RECIPIENT;
    return ret.customer_email || null;
  }

  /**
   * Enqueue email for a return event.
   * @param {string} templateCode - return_created, return_status_changed, return_message, return_resolved
   * @param {object} ret - return object with id, return_number, customer_email, access_token
   * @param {object} extraData - additional template data (new_status_label, message, note, etc.)
   */
  async enqueueEmail(templateCode, ret, extraData = {}) {
    try {
      // Fetch template
      const { data: tpl } = await supabase
        .from('email_templates')
        .select('code, subject_template, body_html, is_active')
        .eq('code', templateCode)
        .single();

      if (!tpl || !tpl.is_active) {
        console.log(`[ReturnEmail] Template ${templateCode} not found or inactive, skipping`);
        return null;
      }

      const recipient = this.getRecipient(ret);
      if (!recipient) {
        console.log(`[ReturnEmail] No recipient for return ${ret.return_number}, skipping`);
        return null;
      }

      const appUrl = process.env.APP_URL || 'https://labelhunter.mroautoapp.cz';
      const statusUrl = `${appUrl}/vraceni/stav/${ret.access_token}`;

      const templateData = {
        return_number: ret.return_number,
        status_url: statusUrl,
        customer_name: ret.customer_name || 'zákazníku',
        ...extraData,
      };

      const subject = this.replaceTags(tpl.subject_template, templateData);
      const bodyHtml = this.replaceTags(tpl.body_html, templateData);

      const { data: queued, error } = await supabase
        .from('email_queue')
        .insert({
          recipient_email: recipient,
          recipient_name: ret.customer_name || null,
          template_code: templateCode,
          template_data: templateData,
          subject,
          body_html: bodyHtml,
          return_id: ret.id,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;
      console.log(`[ReturnEmail] Queued ${templateCode} for return ${ret.return_number} → ${recipient}`);
      return queued;
    } catch (err) {
      console.error(`[ReturnEmail] Failed to enqueue ${templateCode}:`, err.message);
      return null;
    }
  }

  /**
   * Process pending emails in queue.
   */
  async processQueue(limit = 20) {
    const { data: emails, error } = await supabase
      .from('email_queue')
      .select('*')
      .in('status', ['pending', 'failed'])
      .or('next_retry_at.is.null,next_retry_at.lte.' + new Date().toISOString())
      .order('created_at')
      .limit(limit);

    if (error || !emails?.length) return 0;

    let sent = 0;
    for (const email of emails) {
      try {
        await this.transporter.sendMail({
          from: this.getFromAddress(),
          to: email.recipient_email,
          subject: email.subject,
          html: this.wrapHtml(email.body_html),
        });

        await supabase
          .from('email_queue')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', email.id);

        sent++;
      } catch (sendErr) {
        const retries = (email.retry_count || 0) + 1;
        const nextRetry = retries >= 3 ? null : new Date(Date.now() + retries * 5 * 60000).toISOString();

        await supabase
          .from('email_queue')
          .update({
            status: retries >= 3 ? 'failed' : 'queued',
            error_message: sendErr.message,
            retry_count: retries,
            next_retry_at: nextRetry,
          })
          .eq('id', email.id);

        console.error(`[ReturnEmail] Send failed (attempt ${retries}):`, sendErr.message);
      }
    }

    return sent;
  }

  /**
   * Replace {{tag}} placeholders in template text.
   * Supports {{#tag}}...{{/tag}} conditional sections.
   */
  replaceTags(text, data) {
    if (!text) return text;

    // Conditional sections: {{#key}}content{{/key}}
    text = text.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, key, content) => {
      return data[key] ? content : '';
    });

    // Simple replacements: {{key}}
    text = text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      return data[key] !== undefined ? String(data[key]) : '';
    });

    return text;
  }

  /**
   * Wrap email body in HTML template with MROAUTO branding.
   */
  wrapHtml(bodyHtml) {
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f5f5f5">
<div style="max-width:600px;margin:0 auto;background:#fff">
  <div style="background:#1046A0;padding:20px 24px">
    <div style="color:#fff;font-size:20px;font-weight:bold">MROAUTO</div>
    <div style="color:rgba(255,255,255,0.8);font-size:12px">Vrácení a reklamace</div>
  </div>
  <div style="height:4px;background:#D8112A"></div>
  <div style="padding:24px;color:#333;font-size:14px;line-height:1.6">
    ${bodyHtml}
  </div>
  <div style="padding:16px 24px;background:#f5f5f5;text-align:center;font-size:11px;color:#999">
    MROAUTO AUTODÍLY s.r.o. | www.mroauto.cz
  </div>
</div>
</body></html>`;
  }
}

module.exports = new ReturnEmailService();
