import qrcode from "qrcode-generator";

export class SecureLightningPay {
  constructor(config) {
    this.validateConfig(config);
    this.paymentSystem = config.paymentSystem;
    this.albyAccountId = config.albyAccountId;
    this.lnbitsUrl = config.lnbitsUrl;
    this.lnbitsWalletId = config.lnbitsWalletId;
    this.amount = this.validateAmount(config.amount);
    this.targetElement = config.targetElement;
    this.generateQrButton = config.generateQrButton;
    this.openWalletButton = config.openWalletButton;
    
  }

  validateConfig(config) {
    if (!config.paymentSystem || !['getalby', 'lnbits'].includes(config.paymentSystem)) {
      throw new Error("Invalid or missing payment system");
    }
    if (config.paymentSystem === 'getalby' && !config.albyAccountId) {
      throw new Error("Alby account ID is required for Getalby payment system");
    }
    if (config.paymentSystem === 'lnbits' && (!config.lnbitsUrl || !config.lnbitsWalletId)) {
      throw new Error("LNbits URL and wallet ID are required for LNbits payment system");
    }
    if (!config.targetElement || !config.generateQrButton || !config.openWalletButton) {
      throw new Error("Missing required DOM elements");
    }
  }

  validateAmount(amount) {
    const parsedAmount = parseInt(amount, 10);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      throw new Error("Invalid amount. Must be a positive integer.");
    }
    return parsedAmount;
  }

  async generateQRCode() {
    try {
      const invoiceData = await this.getInvoiceData();
      if (!invoiceData || !invoiceData.pr) {
        throw new Error("Invalid invoice data received");
      }
      this.renderQRCode(invoiceData.pr);
      this.showQRCodeContainer();
    } catch (error) {
      this.handleError("Failed to generate QR code", error);
    }
  }

  async getInvoiceData() {
    switch (this.paymentSystem) {
      case "getalby":
        const lnurlParams = await this.fetchLNURLParams();
        return await this.requestInvoice(lnurlParams);
      case "lnbits":
        return await this.createLNbitsInvoice();
      default:
        throw new Error("Invalid payment system configured");
    }
  }

  async fetchLNURLParams() {
    const url = new URL(`https://getalby.com/lnurlp/${encodeURIComponent(this.albyAccountId)}`);
    return await this.secureFetch(url);
  }

  async requestInvoice(params) {
    if (!params.callback) {
      throw new Error("Invalid LNURL params: missing callback URL");
    }
    const callbackUrl = new URL(params.callback);
    callbackUrl.searchParams.append("amount", this.amount * 1000); // Convert sats to millisats

    if (params.metadata) {
      callbackUrl.searchParams.append("metadata", params.metadata);
    }

    return await this.secureFetch(callbackUrl);
  }

  async createLNbitsInvoice() {
    const url = new URL(`${this.lnbitsUrl}/api/v1/payments`);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": this.lnbitsWalletId,
      },
      body: JSON.stringify({
        out: false,
        amount: this.amount,
        memo: "LNbits Payment",
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create LNbits invoice: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return { pr: data.payment_request };
  }

  async secureFetch(url) {
    if (!url.protocol.startsWith('https')) {
      throw new Error('Only HTTPS URLs are allowed');
    }
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  }

  renderQRCode(paymentRequest) {
    this.targetElement.innerHTML = "";

    try {
      const qr = qrcode(0, "L");
      qr.addData(paymentRequest);
      qr.make();
      const qrCodeImg = qr.createImgTag(5);
      this.targetElement.innerHTML = qrCodeImg;
    } catch (error) {
      this.handleError("Failed to generate QR code", error);
      return;
    }

    this.openWalletButton.href = `lightning:${encodeURIComponent(paymentRequest)}`;
    this.openWalletButton.style.display = "inline-block";
  }

  handleError(message, error) {
    console.error(message, error);
    const errorElement = document.createElement('p');
    errorElement.className = 'error';
    errorElement.textContent = `${message}: ${error.message}`;
    this.targetElement.innerHTML = '';
    this.targetElement.appendChild(errorElement);
  }

  showQRCodeContainer() {
    this.targetElement.style.display = "block";
    this.generateQrButton.style.display = "none";
  }
}


// Usage
// const lnbitsKey = import.meta.env.VITE_LNBITS_INVOICE_KEY;

// const lnPay = new SecureLightningPay({
//   paymentSystem: "lnbits", // or 'getalby', depending on admin configuration
//   albyAccountId: "yeghro", // Your Alby account ID (if using Getalby)
//   lnbitsUrl: "https://lnbits.yeghro.site", // Your LNbits instance URL (if using LNbits)
//   lnbitsWalletId: lnbitsKey, // Your LNbits wallet ID (if using LNbits)
//   amount: 1000, // desired tip amount in sats
//   targetElement: document.getElementById("qr-code-container"),
//   generateQrButton: document.getElementById("generate-qr"),
//   openWalletButton: document.getElementById("open-wallet"),
// });

// document.getElementById("generate-qr").addEventListener("click", () => {
//   lnPay.generateQRCode();
// });