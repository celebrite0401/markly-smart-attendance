import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

interface QRCodeCanvasProps {
  token: string;
  size?: number;
}

const QRCodeCanvas = ({ token, size = 200 }: QRCodeCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Generate real QR code with the app link and token
    const qrData = `smart-attendance://checkin?token=${encodeURIComponent(token)}`;
    
    QRCode.toCanvas(canvas, qrData, {
      width: size,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    }).catch(err => {
      console.error('QR Code generation failed:', err);
    });

  }, [token, size]);

  return (
    <div className="inline-block p-4 bg-white rounded-lg shadow-elegant">
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        className="border border-border rounded animate-qr-refresh"
      />
      <div className="text-xs text-center mt-2 text-muted-foreground font-mono">
        Token: {token.slice(0, 8)}...
      </div>
    </div>
  );
};

export default QRCodeCanvas;