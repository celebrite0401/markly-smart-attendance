import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import BarcodeScannerComponent from 'react-qr-barcode-scanner';
// Type workaround for library typing
const AnyBarcodeScanner: any = BarcodeScannerComponent;
import { useAuth } from '@/contexts/AuthContext';

const StudentScan = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scannedText, setScannedText] = useState('');

  useEffect(() => {
    if (!user || !profile || profile.role !== 'student') {
      navigate('/login');
      return;
    }
  }, [user, profile, navigate]);

  const handleScan = async (_: any, result: any) => {
    try {
      if (!result?.text) return;
      const text: string = result.text as string;
      setScannedText(text);

      // Expecting format: smart-attendance://checkin?token=...
      let token: string | null = null;
      try {
        if (text.startsWith('smart-attendance://')) {
          const url = new URL(text);
          token = url.searchParams.get('token');
        } else {
          // Try as regular URL or raw token param
          const maybeUrl = new URL(text, window.location.origin);
          token = maybeUrl.searchParams.get('token');
        }
      } catch {
        // Not a URL, try to parse token directly
        const maybeTokenMatch = text.match(/token=([^&]+)/);
        token = maybeTokenMatch ? decodeURIComponent(maybeTokenMatch[1]) : null;
      }

      if (!token) {
        toast.error('Invalid QR code. Token not found.');
        return;
      }

      // Decode token to extract sessionId
      let sessionId: string | null = null;
      try {
        const decoded = JSON.parse(atob(token));
        sessionId = decoded.sessionId;
      } catch (e) {
        console.error('Token decode failed:', e);
        toast.error('Invalid QR token.');
        return;
      }

      if (!sessionId) {
        toast.error('Invalid session in QR.');
        return;
      }

      toast.success('QR scanned! Proceeding to check-in...');
      navigate(`/student/checkin/${sessionId}?token=${encodeURIComponent(token)}`);
    } catch (err) {
      console.error('Scan error:', err);
      toast.error('Failed to process QR code.');
    }
  };

  return (
    <div className="min-h-screen gradient-subtle">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <Card className="shadow-elegant border-0">
            <CardHeader className="text-center">
              <CardTitle>Scan Attendance QR</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg overflow-hidden bg-muted">
                <AnyBarcodeScanner
                  width={520}
                  height={380}
                  onUpdate={handleScan}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-3 break-all">{scannedText}</p>
              <div className="mt-4">
                <Button variant="secondary" className="w-full" onClick={() => navigate('/student/home')}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default StudentScan;
