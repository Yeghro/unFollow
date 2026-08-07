import qrcode from "qrcode-generator";

// SecureLightningPay class handles Lightning Network payments via the local server API
export class SecureLightningPay {
  // Constructor initializes payment configuration
  constructor(config) {
    // Base URL for API requests
    this.apiBaseUrl = config.apiBaseUrl || '';
    // Available tip amounts in sats
    this.tipAmounts = config.tipAmounts || [1000, 5000, 10000, 20000];
    this.amount = config.amount;

    // DOM elements for UI interaction
    this.targetElement = config.targetElement;
    this.qrCodeContainer = config.targetElement;
    this.showTipOptionsButton = config.showTipOptionsButton;
    this.tipAmountContainer = config.tipAmountContainer;
    this.openWalletButton = config.openWalletButton;

    if (!this.qrCodeContainer || !this.openWalletButton || !this.tipAmountContainer) {
      throw new Error('Required UI elements not provided');
    }

    // Initialize the UI elements
    this.initializeUI();
  }

  // Main payment flow methods:
  // 1. getInvoiceData: Gets invoice via server API
  // 2. createInvoice: Creates invoice via server API
  // 3. checkPayment: Monitors payment status via server API

  // Helper methods for UI handling:
  // - initializeUI: Sets up event listeners
  // - showTipOptions: Displays tip amount buttons
  // - handleTip: Processes tip amount selection
  // - displayInvoice: Shows invoice QR code
  // - renderQRCode: Generates QR code image

  async getInvoiceData() {
    return await this.createInvoice();
  }

  async createInvoice() {
    // Create invoice using the server API
    const requestBody = {
      amount: this.amount
    };

    const response = await fetch(`${this.apiBaseUrl}/api/create-invoice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Failed to create invoice: ${response.status}`);
    }

    return await response.json();
  }

  async checkPayment(paymentIdentifier) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/check-payment/${paymentIdentifier}`);
      if (!response.ok) {
        throw new Error(`Failed to check payment status: ${response.status}`);
      }
      const data = await response.json();
      return { paid: data.paid };
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
    // Disable tip buttons while a request is in flight
    const buttons = this.tipAmountContainer.querySelectorAll('.tip-amount-button');
    buttons.forEach(btn => btn.disabled = true);

    try {
      this.amount = parseInt(amount, 10);
      if (isNaN(this.amount) || this.amount <= 0) {
        this.handleError('Invalid amount. Please try again.', amount);
        return;
      }
      const invoiceData = await this.getInvoiceData();
      await this.displayInvoice(invoiceData);
    } catch (error) {
      this.handleError('Error handling tip:', error);
    } finally {
      buttons.forEach(btn => btn.disabled = false);
    }
  }

  displayInvoice(invoiceData) {
    let paymentRequest;

    // Both LNbits and Coinos come back normalized from our server
    paymentRequest = invoiceData?.paymentRequest || invoiceData?.payment_request;

    if (paymentRequest) {
      this.renderQRCode(paymentRequest);
      this.showQRCodeContainer();
      if (this.openWalletButton) {
        this.openWalletButton.href = `lightning:${paymentRequest}`;
        this.openWalletButton.style.display = "block";
      } else {
        console.error('Open Wallet button not found');
      }

      // Start payment check
      if (invoiceData.paymentHash) {
        this.startPaymentCheck(invoiceData.paymentHash);
      }
    } else {
        throw new Error(`Invalid invoice data: ${JSON.stringify(invoiceData)}`);
    }
  }

  startPaymentCheck(paymentHash) {
    // Cancel any previous poller to avoid stacking
    if (this._pollInterval) {
      clearInterval(this._pollInterval);
    }
    let attempts = 0;
    let consecutiveErrors = 0;
    const maxAttempts = 60; // 5 minutes maximum (with 5-second intervals)
    const maxConsecutiveErrors = 3;

    const checkInterval = setInterval(async () => {
      try {
        attempts++;
        const { paid } = await this.checkPayment(paymentHash);

        if (paid) {
          clearInterval(checkInterval);
          this._pollInterval = null;
          this.handleSuccessfulPayment();
        } else if (attempts >= maxAttempts) {
          clearInterval(checkInterval);
          this._pollInterval = null;
          this.handleFailedPayment();
        }
      } catch (error) {
        console.error('Error checking payment:', error);
        consecutiveErrors++;
        if (consecutiveErrors >= maxConsecutiveErrors) {
          clearInterval(checkInterval);
          this._pollInterval = null;
          this.handleFailedPayment();
        }
      }
    }, 5000);

    this._pollInterval = checkInterval;
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
