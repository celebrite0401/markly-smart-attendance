import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Users, Clock, ArrowRight, QrCode, Camera } from 'lucide-react';
import MarklyLogo from '@/components/MarklyLogo';

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen gradient-subtle">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <div className="flex justify-center mb-6">
            <MarklyLogo size="xl" />
          </div>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Modern face verification attendance system with secure QR code scanning. 
            One-tap activation, 90-second windows, and rotating QR codes.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              variant="primary" 
              size="lg"
              onClick={() => navigate('/login')}
              className="text-lg px-8 py-3"
            >
              Get Started
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button 
              variant="outline" 
              size="lg"
              className="text-lg px-8 py-3"
            >
              Learn More
            </Button>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <Card className="shadow-markly border-0 text-center">
            <CardHeader className="pb-4">
              <div className="w-12 h-12 rounded-full gradient-markly mx-auto mb-4 flex items-center justify-center">
                <QrCode className="w-6 h-6 text-white" />
              </div>
              <CardTitle className="text-xl">Rotating QR Codes</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-base">
                Secure 10-second rotating QR codes prevent unauthorized access and ensure real-time attendance.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="shadow-markly border-0 text-center">
            <CardHeader className="pb-4">
              <div className="w-12 h-12 rounded-full gradient-success mx-auto mb-4 flex items-center justify-center">
                <Camera className="w-6 h-6 text-white" />
              </div>
              <CardTitle className="text-xl">Face Verification</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-base">
                Advanced face recognition with liveness detection ensures accurate student identification.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="shadow-markly border-0 text-center">
            <CardHeader className="pb-4">
              <div className="w-12 h-12 rounded-full gradient-warning mx-auto mb-4 flex items-center justify-center">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <CardTitle className="text-xl">90-Second Windows</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-base">
                Quick 90-second attendance windows with optional 30-second extension for efficient class management.
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* Quick Access */}
        <div className="bg-card/50 backdrop-blur-sm rounded-2xl p-8 text-center shadow-markly">
          <h2 className="text-2xl font-bold mb-4">Quick Access</h2>
          <p className="text-muted-foreground mb-6">
            Choose your role to access the Markly system
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md mx-auto">
            <Button 
              variant="primary" 
              className="h-16 flex-col gap-2"
              onClick={() => navigate('/login')}
            >
              <Users className="w-6 h-6" />
              <span>Teacher Login</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-16 flex-col gap-2"
              onClick={() => navigate('/login')}
            >
              <QrCode className="w-6 h-6" />
              <span>Student Login</span>
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div>
            <div className="text-3xl font-bold text-primary mb-2">10s</div>
            <div className="text-sm text-muted-foreground">QR Rotation</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-success mb-2">90s</div>
            <div className="text-sm text-muted-foreground">Session Window</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-warning mb-2">99.9%</div>
            <div className="text-sm text-muted-foreground">Accuracy</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-primary mb-2">2s</div>
            <div className="text-sm text-muted-foreground">Check-in Speed</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
