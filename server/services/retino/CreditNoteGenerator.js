const PDFDocument = require('pdfkit');

/**
 * CreditNoteGenerator — generování dobropisů (opravný daňový doklad) v PDF.
 * Formát: česká faktura/dobropis.
 */
class CreditNoteGenerator {
  /**
   * Generate credit note PDF as a Buffer.
   * @param {object} data
   * @param {string} data.creditNoteNumber - číslo dobropisu
   * @param {string} data.originalInvoice - číslo původní faktury
   * @param {string} data.date - datum vystavení
   * @param {string} data.returnNumber - číslo žádosti o vrácení
   * @param {object} data.seller - { name, address, ico, dic }
   * @param {object} data.buyer - { name, address, ico, dic }
   * @param {Array} data.items - [{ text, qty, pricePerUnit, vatRate }]
   * @param {number} data.totalAmount
   * @param {string} data.currency
   * @param {string} data.note
   * @returns {Promise<Buffer>}
   */
  async generate(data) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const chunks = [];

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Header
        doc.fontSize(20).font('Helvetica-Bold').text('DOBROPIS', { align: 'center' });
        doc.fontSize(10).font('Helvetica').text(`(Opravný daňový doklad)`, { align: 'center' });
        doc.moveDown(1.5);

        // Credit note info
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text(`Číslo dobropisu: ${data.creditNoteNumber}`);
        doc.font('Helvetica');
        doc.text(`Datum vystavení: ${data.date || new Date().toLocaleDateString('cs-CZ')}`);
        doc.text(`Původní faktura: ${data.originalInvoice || '-'}`);
        doc.text(`Žádost: ${data.returnNumber || '-'}`);
        doc.moveDown(1);

        // Seller / Buyer side by side
        const y = doc.y;

        // Seller (left)
        doc.font('Helvetica-Bold').text('Dodavatel:', 50, y);
        doc.font('Helvetica');
        const seller = data.seller || {};
        doc.text(seller.name || 'MROAUTO AUTODÍLY s.r.o.', 50, doc.y);
        doc.text(seller.address || 'Průmyslová 1472, 280 02 Kolín');
        if (seller.ico) doc.text(`IČO: ${seller.ico}`);
        if (seller.dic) doc.text(`DIČ: ${seller.dic}`);

        // Buyer (right)
        const buyerX = 300;
        doc.font('Helvetica-Bold').text('Odběratel:', buyerX, y);
        doc.font('Helvetica');
        const buyer = data.buyer || {};
        doc.text(buyer.name || '-', buyerX, doc.y);
        if (buyer.address) doc.text(buyer.address, buyerX);
        if (buyer.ico) doc.text(`IČO: ${buyer.ico}`, buyerX);
        if (buyer.dic) doc.text(`DIČ: ${buyer.dic}`, buyerX);

        doc.moveDown(2);

        // Items table
        const tableTop = doc.y;
        const col = { text: 50, qty: 320, price: 380, vat: 440, total: 490 };

        // Header row
        doc.font('Helvetica-Bold').fontSize(9);
        doc.text('Popis', col.text, tableTop);
        doc.text('Ks', col.qty, tableTop, { width: 50, align: 'right' });
        doc.text('Cena/ks', col.price, tableTop, { width: 50, align: 'right' });
        doc.text('DPH', col.vat, tableTop, { width: 40, align: 'right' });
        doc.text('Celkem', col.total, tableTop, { width: 60, align: 'right' });

        doc.moveTo(50, tableTop + 14).lineTo(550, tableTop + 14).stroke('#ccc');

        // Items
        doc.font('Helvetica').fontSize(9);
        let rowY = tableTop + 20;
        const items = data.items || [];

        for (const item of items) {
          const qty = item.qty || 1;
          const price = parseFloat(item.pricePerUnit) || 0;
          const vatRate = item.vatRate || 21;
          const lineTotal = qty * price;

          // Negative amounts for credit note
          doc.text(item.text || '-', col.text, rowY, { width: 260 });
          doc.text(`-${qty}`, col.qty, rowY, { width: 50, align: 'right' });
          doc.text(`${price.toFixed(2)}`, col.price, rowY, { width: 50, align: 'right' });
          doc.text(`${vatRate}%`, col.vat, rowY, { width: 40, align: 'right' });
          doc.text(`-${lineTotal.toFixed(2)}`, col.total, rowY, { width: 60, align: 'right' });

          rowY += 18;
        }

        // Total line
        doc.moveTo(50, rowY + 2).lineTo(550, rowY + 2).stroke('#ccc');
        rowY += 10;

        const totalAmount = parseFloat(data.totalAmount) || items.reduce((sum, i) => sum + (i.qty || 1) * (parseFloat(i.pricePerUnit) || 0), 0);
        const currency = data.currency || 'CZK';

        doc.font('Helvetica-Bold').fontSize(12);
        doc.text(`Celkem k vrácení: -${totalAmount.toFixed(2)} ${currency}`, 50, rowY, { align: 'right', width: 500 });

        // Note
        if (data.note) {
          doc.moveDown(2);
          doc.font('Helvetica').fontSize(9);
          doc.text(`Poznámka: ${data.note}`, 50);
        }

        // Footer
        doc.fontSize(8).font('Helvetica').fillColor('#888');
        doc.text('Vygenerováno systémem Retino | MROAUTO AUTODÍLY s.r.o.', 50, 770, { align: 'center', width: 500 });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}

module.exports = new CreditNoteGenerator();
