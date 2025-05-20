import qrcode from "qrcode-generator";

// SecureLightningPay class handles Lightning Network payments using either LNbits or GetAlby
export class SecureLightningPay {
  // Constructor initializes payment configuration
  constructor(config) {
    // Base URL for API requests
    this.apiBaseUrl = config.apiBaseUrl || '';
    // Available tip amounts in sats
    this.tipAmounts = config.tipAmounts || [1000, 5000, 10000, 20000];
    // DOM elements for UI interaction
    this.targetElement = config.targetElement;
    this.showTipOptionsButton = config.showTipOptionsButton;
    this.tipAmountContainer = config.tipAmountContainer;
    this.openWalletButton = config.openWalletButton;

    // Payment system configuration (lnbits or getalby)
    this.paymentSystem = config.paymentSystem;
    this.albyAccountId = config.albyAccountId;
    this.amount = config.amount;

    // Store UI elements as class properties
    this.qrCodeContainer = config.targetElement;
    this.openWalletButton = config.openWalletButton;
    this.tipAmountContainer = config.tipAmountContainer;
    
    if (!this.qrCodeContainer || !this.openWalletButton || !this.tipAmountContainer) {
      throw new Error('Required UI elements not provided');
    }

    // Initialize the UI elements
    this.initializeUI();
  }

  // Main payment flow methods:
  // 1. generateQRCode: Creates QR code for payment
  // 2. getInvoiceData: Gets invoice based on payment system
  // 3. createInvoice: Creates LNbits invoice
  // 4. requestInvoice: Handles GetAlby invoice request
  // 5. checkPayment: Monitors payment status

  // Helper methods for UI handling:
  // - initializeUI: Sets up event listeners
  // - showTipOptions: Displays tip amount buttons
  // - handleTip: Processes tip amount selection
  // - displayInvoice: Shows invoice QR code
  // - renderQRCode: Generates QR code image

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
    if (this.paymentSystem === 'getalby') {
      const lnurlParams = await this.fetchLNURLParams();
      return await this.requestInvoice(lnurlParams);
    } else {
      return await this.createInvoice();
    }
  }

  async fetchLNURLParams() {
    const url = `https://getalby.com/lnurlp/${this.albyAccountId}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch LNURL params: ${response.status}`);
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

    const response = await fetch(callbackUrl);
    if (!response.ok) {
      throw new Error(`Failed to request invoice: ${response.status}`);
    }
    return await response.json();
  }

  async createInvoice() {
    // Don't duplicate GetAlby logic here since getInvoiceData already handles it
    // LNbits invoice creation using the server
    const response = await fetch(`${this.apiBaseUrl}/api/create-invoice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: this.amount,
        paymentSystem: this.paymentSystem,
        albyAccountId: this.albyAccountId
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to create invoice: ${response.status}`);
    }

    return await response.json();
  }

// Update payment checking for both systems
async checkPayment(paymentIdentifier) {
  try {
    if (this.paymentSystem === 'getalby') {
      // For GetAlby, we need to check their verification URL directly
      const response = await fetch(paymentIdentifier);
      if (!response.ok) {
        throw new Error('Failed to verify payment');
      }
      const data = await response.json();
      return { paid: data.status === 'PAID' };
    } else {
      // For LNbits, use our server API
      const response = await fetch(`${this.apiBaseUrl}/api/check-payment/${paymentIdentifier}`);
      if (!response.ok) {
        throw new Error('Failed to check payment status');
      }
      const data = await response.json();
      return { paid: data.paid };
    }
  } catch (error) {
    console.error('Error checking payment:', error);
    return { paid: false };
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
      const invoiceData = await this.getInvoiceData();
      await this.displayInvoice(invoiceData);
    } catch (error) {
      console.error('Error handling tip:', error);
      alert('Failed to create invoice. Please try again.');
    }
  }

  displayInvoice(invoiceData) {
    let paymentRequest;
    
    if (this.paymentSystem === 'getalby') {
      paymentRequest = invoiceData.pr;
    } else {
      paymentRequest = invoiceData.paymentRequest;
    }
  
    if (paymentRequest) {
      this.renderQRCode(paymentRequest);
      this.showQRCodeContainer();
      if (this.openWalletButton) {
        this.openWalletButton.href = `lightning:${encodeURIComponent(paymentRequest)}`;
        this.openWalletButton.style.display = "block";
      } else {
        console.error('Open Wallet button not found');
      }
      
      // Start payment check if verify URL is provided (GetAlby)
      if (invoiceData.verify) {
        this.startPaymentCheck(invoiceData.verify);
      } else if (invoiceData.paymentHash) {
        // LNbits payment check
        this.startPaymentCheck(invoiceData.paymentHash);
      }
    } else {
      console.error('Invalid invoice data:', invoiceData);
      alert('Failed to generate invoice. Please try again.');
    }
  }
  

  startPaymentCheck(paymentHash) {
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes maximum (with 5-second intervals)
    
    const checkInterval = setInterval(async () => {
      try {
        attempts++;
        const { paid } = await this.checkPayment(paymentHash);
        
        if (paid) {
          clearInterval(checkInterval);
          this.handleSuccessfulPayment();
        } else if (attempts >= maxAttempts) {
          clearInterval(checkInterval);
          this.handleFailedPayment();
        }
      } catch (error) {
        console.error('Error checking payment:', error);
        clearInterval(checkInterval);
        this.handleFailedPayment();
      }
    }, 5000);
  }

  handleSuccessfulPayment() {
    if (!this.qrCodeContainer || !this.openWalletButton || !this.tipAmountContainer) {
      console.error('UI elements not found');
      return;
    }
  
    alert('Payment received! Thank you for your tip.');
    this.qrCodeContainer.style.display = 'none';
    this.openWalletButton.style.display = 'none';
    this.tipAmountContainer.style.display = 'none';
  }

  handleFailedPayment() {
    console.error('Payment verification timeout or error');
    alert('Payment verification failed or timed out. Please try again.');
  }

  renderQRCode(paymentRequest) {
    if (!this.qrCodeContainer) {
      console.error('QR code container not found');
      return;
    }
    
    // Clear previous QR code
    this.qrCodeContainer.innerHTML = '';
    
    // Generate QR code
    const qr = qrcode(0, 'L');
    qr.addData(paymentRequest);
    qr.make();
    
    // Create QR code image
    const qrImage = qr.createImgTag(5);
    this.qrCodeContainer.innerHTML = qrImage;
  }

  showQRCodeContainer() {
    if (this.qrCodeContainer) {
      this.qrCodeContainer.style.display = 'block';
    }
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