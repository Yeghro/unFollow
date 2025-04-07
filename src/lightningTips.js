import qrcode from "qrcode-generator";

export class SecureLightningPay {
  constructor(config) {
    this.targetElement = config.targetElement;
    this.showTipOptionsButton = config.showTipOptionsButton;
    this.tipAmountContainer = config.tipAmountContainer;
    this.openWalletButton = config.openWalletButton;
    this.tipAmounts = config.tipAmounts || [1000, 5000, 10000, 20000];
    this.paymentSystem = config.paymentSystem || 'lnbits';

    this.initializeUI();
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
        if (!lnurlParams.callback) {
          throw new Error("Invalid LNURL params: missing callback URL");
        }
        const callbackUrl = new URL(lnurlParams.callback);
        callbackUrl.searchParams.append("amount", this.amount * 1000);
        if (lnurlParams.metadata) {
          callbackUrl.searchParams.append("metadata", lnurlParams.metadata);
        }
        return this.createInvoice(callbackUrl.toString());
      case "lnbits":
        return this.createInvoice();
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
    try {
      const response = await fetch('/api/create-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          amount,
          paymentSystem: this.paymentSystem 
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Payment error: ${errorData.error}`);
      }

      const invoiceData = await response.json();
      await this.displayInvoice(invoiceData);
      this.startPaymentCheck(invoiceData.paymentHash);
    } catch (error) {
      this.handleError('Error handling tip:', error);
    }
  }

  displayInvoice(invoiceData) {
    console.log('Received invoice data:', invoiceData); // Debug log
    
    if (invoiceData && invoiceData.paymentRequest) {
        this.renderQRCode(invoiceData.paymentRequest);
        this.showQRCodeContainer();
        
        if (this.openWalletButton) {
            this.openWalletButton.href = `lightning:${invoiceData.paymentRequest}`;
            this.openWalletButton.style.display = "block";
        }
    } else if (invoiceData && invoiceData.payment_request) { // Add this fallback
        this.renderQRCode(invoiceData.payment_request);
        this.showQRCodeContainer();
        
        if (this.openWalletButton) {
            this.openWalletButton.href = `lightning:${invoiceData.payment_request}`;
            this.openWalletButton.style.display = "block";
        }
    } else {
        throw new Error(`Invalid invoice data: ${JSON.stringify(invoiceData)}`);
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