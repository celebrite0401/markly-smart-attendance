import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Users, BookOpen, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { getTeacherClasses } from '@/lib/api';

const ClassSelection = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [searchParams] = useSearchParams();
  const action = searchParams.get('action') || 'register';
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !profile || profile.role !== 'teacher') {
      navigate('/teacher/dashboard');
      return;
    }
    
    fetchClasses();
  }, [user, profile, navigate]);

  const fetchClasses = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const teacherClasses = await getTeacherClasses(user.id);
      setClasses(teacherClasses);
    } catch (error) {
      console.error('Error fetching classes:', error);
      toast.error('Failed to load classes');
    } finally {
      setLoading(false);
    }
  };

  const handleClassSelect = (classId: string) => {
    switch (action) {
      case 'register':
        navigate(`/teacher/class-register/${classId}`);
        break;
      case 'session':
        navigate(`/teacher/session/${classId}`);
        break;
      default:
        navigate(`/teacher/class-register/${classId}`);
    }
  };

  const getActionTitle = () => {
    switch (action) {
      case 'register':
        return 'Select Class - View Register';
      case 'session':
        return 'Select Class - Start Session';
      default:
        return 'Select Class';
    }
  };

  const getActionIcon = () => {
    switch (action) {
      case 'register':
        return <Users className="w-5 h-5" />;
      case 'session':
        return <Calendar className="w-5 h-5" />;
      default:
        return <BookOpen className="w-5 h-5" />;
    }
  };

  return (
    <div className="min-h-screen gradient-subtle">
      {/* Header */}
      <div className="bg-card/80 backdrop-blur-sm border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate('/teacher/dashboard')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <div>
              <h1 className="text-xl font-bold gradient-markly bg-clip-text text-transparent">
                {getActionTitle()}
              </h1>
              <p className="text-sm text-muted-foreground">
                Choose a class from your available classes
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2 text-muted-foreground">Loading classes...</span>
          </div>
        ) : classes.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Classes Found</h3>
            <p className="text-muted-foreground mb-4">You don't have any classes assigned yet</p>
            <Button variant="outline" onClick={() => navigate('/teacher/dashboard')}>
              Return to Dashboard
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2">Your Classes</h2>
              <p className="text-muted-foreground">
                Select a class to {action === 'register' ? 'view its register' : 'continue'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
              {classes.map((classItem) => (
                <Card 
                  key={classItem.id} 
                  className="shadow-elegant border-0 transition-smooth hover:shadow-glow cursor-pointer"
                  onClick={() => handleClassSelect(classItem.id)}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{classItem.name}</CardTitle>
                      <Badge variant="outline">
                        {(classItem.enrollments?.[0]?.count || 0)} students
                      </Badge>
                    </div>
                    {classItem.description && (
                      <p className="text-sm text-muted-foreground">
                        {classItem.description}
                      </p>
                    )}
                  </CardHeader>

                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Schedule:</span>
                        <span>{
                          Array.isArray(classItem.schedule) 
                            ? classItem.schedule.map((s: any) => s.day).join(', ') || 'Not set'
                            : 'Not set'
                        }</span>
                      </div>
                      
                      <Button 
                        variant="primary"
                        className="w-full"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleClassSelect(classItem.id);
                        }}
                      >
                        {getActionIcon()}
                        <span className="ml-2">
                          {action === 'register' ? 'View Register' : 'Select Class'}
                        </span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ClassSelection;