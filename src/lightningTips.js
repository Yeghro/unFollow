import qrcode from "qrcode-generator";

export class SecureLightningPay {
  constructor(config) {
    this.apiBaseUrl = config.apiBaseUrl || '';
    this.tipAmounts = config.tipAmounts || [1000, 5000, 10000, 20000];
    this.targetElement = config.targetElement;
    this.showTipOptionsButton = config.showTipOptionsButton;
    this.tipAmountContainer = config.tipAmountContainer;
    this.openWalletButton = config.openWalletButton;

    this.paymentSystem = config.paymentSystem;
    this.albyAccountId = config.albyAccountId;
    this.amount = config.amount;

    this.initializeUI();``

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
        return await this.createInvoice();
      default:
        throw new Error("Invalid payment system configured");
    }
  }

  async fetchLNURLParams() {
    const response = await fetch(`/api/fetch-lnurl-params/${encodeURIComponent(this.albyAccountId)}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
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

    const response = await fetch('/api/create-invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        paymentSystem: 'getalby', 
        callbackUrl: callbackUrl.toString() 
      })
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  }

  async createInvoice() {
    try {
      const response = await fetch('/api/create-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          paymentSystem: 'lnbits', 
          amount: this.amount 
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.error}`);
      }
      
      return await response.json();
    } catch (error) {
      throw error;
    }
  }

  async checkPayment(paymentHash) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/check-payment/${paymentHash}`);
      if (!response.ok) {
        throw new Error('Failed to check payment status');
      }
      return response.json();
    } catch (error) {
      console.error('Error checking payment:', error);
      throw error;
    }
  }

  initializeUI() {
    this.showTipOptionsButton.addEventListener('click', () => this.showTipOptions());
    this.tipAmountContainer.innerHTML = this.tipAmounts.map(amount => 
      `<button class="tip-amount-button" data-amount="${amount}">${amount} sats</button>`
    ).join('');
    this.tipAmountContainer.addEventListener('click', (e) => {
      if (e.target.classList.contains('tip-amount-button')) {
        this.handleTip(parseInt(e.target.dataset.amount));
      }
    });
  }

  showTipOptions() {
    this.tipAmountContainer.style.display = 'block';
  }

  async handleTip(amount) {
    this.amount = parseInt(amount, 10);
    if (isNaN(this.amount) || this.amount <= 0) {
      console.error('Invalid amount:', amount);
      alert('Invalid amount. Please try again.');
      return;
    }
    try {
      const invoiceData = await this.createInvoice();
      this.displayInvoice(invoiceData);
    } catch (error) {
      console.error('Error handling tip:', error);
      alert('Failed to create invoice. Please try again.');
    }
  }

  displayInvoice(invoiceData) {
    if (invoiceData && invoiceData.paymentRequest) {
      this.renderQRCode(invoiceData.paymentRequest);
      this.showQRCodeContainer();
      if (this.openWalletButton) {
        this.openWalletButton.href = `lightning:${encodeURIComponent(invoiceData.paymentRequest)}`;
        this.openWalletButton.style.display = "block";
      } else {
        console.error('Open Wallet button not found');
      }
    } else {
      console.error('Invalid invoice data:', invoiceData);
      alert('Failed to generate invoice. Please try again.');
    }
  }

  startPaymentCheck(paymentHash) {
    const checkInterval = setInterval(async () => {
      try {
        const { paid } = await this.checkPayment(paymentHash);
        if (paid) {
          clearInterval(checkInterval);
          this.handleSuccessfulPayment();
        }
      } catch (error) {
        console.error('Error checking payment:', error);
      }
    }, 5000);
  }

  handleSuccessfulPayment() {
    alert('Payment received! Thank you for your tip.');
    this.qrCodeContainer.style.display = 'none';
    this.openWalletButton.style.display = 'none';
    this.tipAmountContainer.style.display = 'none';
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

  } 

  showQRCodeContainer() {
    this.targetElement.style.display = 'block';
  } 

  handleError(message, error) {
    console.error(message, error);
    alert(message);
  }
}


// Usage
// const lnbitsKey = import.meta.env.VITE_LNBITS_INVOICE_KEY;

// const lnPay = new SecureLightningPay({
//   paymentSystem: "lnbits", // or 'getalby', depending on admin configuration
//   albyAccountId: "yeghro", // Your Alby account ID (if using Getalby)
//   lnbitsUrl: "https://lnbits.yeghro.site", // Your LNbits instance URL (if using LNbits)
//   lnbitsWalletId: lnbitsKey, // Your LNbits wallet ID (if using LNbits)
//   tipAmounts: [100, 1000, 5000, 10000], // Array of tip amount options in sats
//   targetElement: document.getElementById("qr-code-container"),
//   showTipOptionsButton: document.getElementById("show-tip-options"),
//   tipAmountContainer: document.getElementById("tip-amount-container"),
//   openWalletButton: document.getElementById("open-wallet"),
// });

// The click event listener is now set up in the constructor, so you don't need this:
// document.getElementById("generate-qr").addEventListener("click", () => {
//   lnPay.generateQRCode();
// });