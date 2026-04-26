declare module 'qrcode' {
  type QRCodeToDataURLOptions = {
    margin?: number
    width?: number
  }

  const QRCode: {
    toDataURL(text: string, options?: QRCodeToDataURLOptions): Promise<string>
  }

  export default QRCode
}
