import QRCode from "qrcode/lib/browser";

export async function createQrCodeDataUrl(value: string): Promise<string> {
  const svg = await QRCode.toString(value, { type: "svg", margin: 1, width: 256 });
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
