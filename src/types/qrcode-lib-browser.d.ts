declare module "qrcode/lib/browser" {
  interface SvgOptions {
    type: "svg";
    margin?: number;
    width?: number;
  }

  const QRCode: {
    toString(text: string, options: SvgOptions): Promise<string>;
  };

  export default QRCode;
}
