import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Settings } from 'lucide-react';

const TeacherSettings = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  useEffect(() => {
    if (!user || !profile || profile.role !== 'teacher') {
      navigate('/login');
    }
  }, [user, profile, navigate]);

  return (
    <div className="min-h-screen gradient-subtle">
      <div className="bg-card/80 backdrop-blur-sm border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => navigate('/teacher/dashboard')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Settings className="w-5 h-5" /> Settings
            </h1>
            <div />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <Card className="shadow-elegant border-0 max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Teacher Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">More settings coming soon.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TeacherSettings;
