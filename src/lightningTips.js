import qrcode from "qrcode-generator";

class SecureLightningPay {
  constructor(config) {
    this.paymentSystem = config.paymentSystem || "getalby"; // Default to Getalby
    this.albyAccountId = config.albyAccountId;
    this.lnbitsUrl = config.lnbitsUrl;
    this.lnbitsWalletId = config.lnbitsWalletId;
    this.amount = config.amount || 1000; // Default to 1000 sats if not specified
    this.targetElement = config.targetElement;
    this.generateQrButton = config.generateQrButton;
    this.openWalletButton = config.openWalletButton;
  }

  async generateQRCode() {
    try {
      let invoiceData;
      if (this.paymentSystem === "getalby") {
        const lnurlParams = await this.fetchLNURLParams();
        invoiceData = await this.requestInvoice(lnurlParams);
      } else if (this.paymentSystem === "lnbits") {
        invoiceData = await this.createLNbitsInvoice();
      } else {
        throw new Error("Invalid payment system configured");
      }

      console.log("Invoice data received:", invoiceData);
      if (!invoiceData || !invoiceData.pr) {
        throw new Error("Invalid invoice data received");
      }
      this.renderQRCode(invoiceData.pr);
      this.showQRCodeContainer();
    } catch (error) {
      console.error("Error generating QR code:", error);
      this.renderError("Failed to generate QR code: " + error.message);
    }
  }

  async fetchLNURLParams() {
    const url = `https://getalby.com/lnurlp/${this.albyAccountId}`;
    console.log("Fetching LNURL params from:", url);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch LNURL params: ${response.status} ${response.statusText}`
      );
    }
    const data = await response.json();
    console.log("LNURL params:", data);
    return data;
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

    console.log("Requesting invoice from:", callbackUrl.toString());
    const response = await fetch(callbackUrl.toString());
    if (!response.ok) {
      throw new Error(
        `Failed to request invoice: ${response.status} ${response.statusText}`
      );
    }
    return await response.json();
  }

  async createLNbitsInvoice() {
    const url = `${this.lnbitsUrl}/api/v1/payments`;
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
      throw new Error(
        `Failed to create LNbits invoice: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    return { pr: data.payment_request };
  }

  renderQRCode(paymentRequest) {
    this.targetElement.innerHTML = "";

    try {
      console.log("Generating QR code for payment request:", paymentRequest);
      const qr = qrcode(0, "L");
      qr.addData(paymentRequest);
      qr.make();
      this.targetElement.innerHTML = qr.createImgTag(5);
    } catch (error) {
      console.error("Error generating QR code:", error);
      this.renderError("Failed to generate QR code: " + error.message);
    }

    this.openWalletButton.href = `lightning:${paymentRequest}`;
    this.openWalletButton.style.display = "inline-block";
  }

  renderError(message) {
    this.targetElement.innerHTML = `<p class="error">${message}</p>`;
  }

  showQRCodeContainer() {
    this.targetElement.style.display = "block";
    this.generateQrButton.style.display = "none";
  }
}

// Usage
const lnPay = new SecureLightningPay({
  paymentSystem: "lnbits", // or 'lnbits', depending on admin configuration
  albyAccountId: "yeghro", // Your Alby account ID (if using Getalby)
  lnbitsUrl: "https://lnbits.yeghro.site", // Your LNbits instance URL (if using LNbits)
  lnbitsWalletId: "ca9819671ed44f10803e261368b0bb83", // Your LNbits wallet ID (if using LNbits)
  amount: 1000, // desired tip amount in sats
  targetElement: document.getElementById("qr-code-container"),
  generateQrButton: document.getElementById("generate-qr"),
  openWalletButton: document.getElementById("open-wallet"),
});

document.getElementById("generate-qr").addEventListener("click", () => {
  lnPay.generateQRCode();
});
