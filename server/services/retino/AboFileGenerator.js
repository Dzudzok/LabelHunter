/**
 * ABO File Generator — český bankovní standard pro hromadné příkazy.
 *
 * ABO format: fixed-width text file (128 chars per line).
 * Lines:
 *   1. UHL1 — file header
 *   2+ — individual payment records
 *   Last — UHL1 summary (optional)
 *
 * Reference: https://www.cnb.cz/cs/platebni-styk/abo/
 */
class AboFileGenerator {
  /**
   * Generate ABO file content.
   * @param {object} params
   * @param {string} params.senderAccount - "123456789/0100"
   * @param {string} params.batchNumber
   * @param {Array} params.items - [{ recipientAccount, amount, variableSymbol, constantSymbol, specificSymbol, message }]
   * @returns {string} ABO file content
   */
  generate({ senderAccount, batchNumber, items }) {
    const lines = [];
    const [accountNum, bankCode] = this.parseAccount(senderAccount);
    const date = this.formatDate(new Date());
    const totalAmount = items.reduce((sum, i) => sum + Math.round(i.amount * 100), 0);

    // UHL1 — file header
    lines.push(this.buildHeader({
      accountNum,
      bankCode,
      batchNumber,
      date,
      itemCount: items.length,
      totalAmount,
    }));

    // Payment items
    for (const item of items) {
      const [recipAccount, recipBank] = this.parseAccount(item.recipientAccount);
      lines.push(this.buildItem({
        recipientAccount: recipAccount,
        recipientBankCode: recipBank,
        amount: Math.round(item.amount * 100),
        variableSymbol: item.variableSymbol || '',
        constantSymbol: item.constantSymbol || '0558',
        specificSymbol: item.specificSymbol || '',
        message: item.message || '',
        date,
      }));
    }

    return lines.join('\r\n') + '\r\n';
  }

  buildHeader({ accountNum, bankCode, batchNumber, date, itemCount, totalAmount }) {
    // UHL1 format: fixed 128 chars
    let line = 'UHL1';
    line += this.pad(accountNum, 16);         // sender account
    line += this.pad(bankCode, 4);            // sender bank code
    line += this.pad(batchNumber, 13);        // batch identifier
    line += date;                             // DDMMYY (6)
    line += this.pad('', 20);                 // reserved
    line += this.padNum(itemCount, 6);        // item count
    line += this.padNum(totalAmount, 15);     // total amount in haléře
    line += this.pad('', 44);                 // reserved
    return line.substring(0, 128);
  }

  buildItem({ recipientAccount, recipientBankCode, amount, variableSymbol, constantSymbol, specificSymbol, message, date }) {
    let line = '';
    line += this.pad(recipientAccount, 16);   // recipient account
    line += this.pad(recipientBankCode, 4);   // recipient bank code
    line += this.padNum(amount, 15);          // amount in haléře
    line += this.pad(variableSymbol, 10);     // variable symbol
    line += this.pad(constantSymbol, 4);      // constant symbol
    line += this.pad(specificSymbol, 10);     // specific symbol
    line += date;                             // DDMMYY (6)
    line += this.pad(message, 35);            // message for recipient
    line += this.pad('', 28);                 // reserved
    return line.substring(0, 128);
  }

  parseAccount(account) {
    if (!account) return ['', ''];
    const parts = account.replace(/\s/g, '').split('/');
    return [parts[0] || '', parts[1] || ''];
  }

  formatDate(d) {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    return dd + mm + yy;
  }

  pad(str, len) {
    return String(str || '').substring(0, len).padEnd(len, ' ');
  }

  padNum(num, len) {
    return String(num || 0).padStart(len, '0');
  }
}

module.exports = new AboFileGenerator();
