import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, Users, Clock, BookOpen, LogOut, Settings, Loader2, History, Bell } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { getTeacherClasses, Class, getActiveSessionsCount } from '@/lib/api';
import { supabase } from '@/integrations/supabase/client';
import MarklyLogo from '@/components/MarklyLogo';

const TeacherDashboard = () => {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSessions, setActiveSessions] = useState(0);
  const [sendingNotifications, setSendingNotifications] = useState(false);

  useEffect(() => {
    if (!user || !profile) {
      navigate('/login');
      return;
    }
    
    if (profile.role !== 'teacher') {
      navigate('/login');
      return;
    }

    fetchTeacherClasses();
    
    // Set up real-time subscription for session updates
    const channel = supabase
      .channel(`teacher-sessions-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sessions',
          filter: `teacher_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Session update received:', payload);
          // Reload active sessions count
          loadActiveSessionsCount();
        }
      )
      .subscribe((status) => {
        console.log('Session subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, profile, navigate]);

  const loadActiveSessionsCount = async () => {
    if (!user) return;
    
    try {
      const count = await getActiveSessionsCount(user.id);
      setActiveSessions(count);
      console.log('Updated active sessions count:', count);
    } catch (error) {
      console.error('Error loading active sessions count:', error);
    }
  };

  const fetchTeacherClasses = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const teacherClasses = await getTeacherClasses(user.id);
      setClasses(teacherClasses);
      
      // Load real active sessions count
      await loadActiveSessionsCount();
    } catch (error) {
      console.error('Error fetching classes:', error);
      toast.error('Failed to load classes');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success('Logged out successfully');
      navigate('/login', { replace: true });
    } catch (error) {
      toast.error('Logout failed');
      console.error('Logout error:', error);
    }
  };

  const sendAbsenceNotifications = async () => {
    if (!user) return;
    try {
      setSendingNotifications(true);
      // Show immediate feedback and stop spinner shortly to avoid "hanging" UI while backend runs
      const spinnerTimeout = setTimeout(() => setSendingNotifications(false), 1500);
      toast.info('Starting absence notifications across all your classes...');

      const invokePromise = supabase.functions.invoke('send-all-absence-notifications', {
        body: { teacherId: user.id }
      });

      invokePromise
        .then(({ data, error }) => {
          if (error) throw error;
          const result = data || ({} as any);
          // If our Edge function returns 202/background-started, inform the user
          if ((result as any).started) {
            toast.success('Notifications job started in background. You will receive emails shortly.');
          } else if (result.message?.includes('No recent sessions found')) {
            toast.info('No recent sessions in the last 24 hours.');
          } else {
            toast.success(`Notifications sent: processed ${result.sessionsProcessed || 0} sessions, ${result.notificationsSent || 0} emails.`);
          }
        })
        .catch((err: any) => {
          console.error('Error sending absence notifications:', err);
          toast.error(`Failed to send notifications: ${err.message || 'Unknown error'}`);
        })
        .finally(() => {
          clearTimeout(spinnerTimeout);
          setSendingNotifications(false);
        });
    } catch (err: any) {
      console.error('Unexpected error starting notifications:', err);
      toast.error('Unable to start notifications');
      setSendingNotifications(false);
    }
  };

  const activateAttendance = (classId: string) => {
    navigate(`/teacher/session/${classId}`);
  };

  const getTotalStudents = () => {
    return classes.reduce((sum, cls) => {
      const enrollments = cls.enrollments;
      return sum + (enrollments?.[0]?.count || 0);
    }, 0);
  };

  if (!user || !profile) return null;

  return (
    <div className="min-h-screen gradient-subtle">
      {/* Header */}
      <div className="bg-card/80 backdrop-blur-sm border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MarklyLogo size="md" showText={false} className="sm:hidden" />
              <MarklyLogo size="md" className="hidden sm:flex" />
              <div className="hidden lg:block">
                <h1 className="text-xl font-bold gradient-markly bg-clip-text text-transparent">
                  Teacher Dashboard
                </h1>
                <p className="text-sm text-muted-foreground">
                  Manage your classes and attendance
                </p>
              </div>
            </div>
             
            <div className="flex items-center gap-2 lg:gap-3">
              {profile && (
                <div className="text-right hidden md:block">
                  <p className="font-medium text-sm lg:text-base">{profile.name}</p>
                  <p className="text-xs lg:text-sm text-muted-foreground">{profile.email}</p>
                </div>
              )}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={sendAbsenceNotifications}
                disabled={sendingNotifications}
                className="hidden sm:flex"
              >
                {sendingNotifications ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Bell className="w-4 h-4 mr-2" />
                )}
                <span className="hidden lg:inline">Send All Absence Notifications</span>
                <span className="lg:hidden">Send Notifications</span>
              </Button>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 mb-6 lg:mb-8">
          <Card className="shadow-elegant border-0">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{classes.length}</p>
                  <p className="text-sm text-muted-foreground">Active Classes</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-elegant border-0">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center">
                  <Users className="w-6 h-6 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{getTotalStudents()}</p>
                  <p className="text-sm text-muted-foreground">Total Students</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-elegant border-0">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{activeSessions}</p>
                  <p className="text-sm text-muted-foreground">Active Sessions</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Classes */}
        <div>
          <div className="mb-6">
            <h2 className="text-2xl font-bold">Your Classes</h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Loading classes...</span>
            </div>
          ) : classes.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Classes Yet</h3>
              <p className="text-muted-foreground mb-4">Start by creating your first class</p>
              <Button variant="outline">
                <Settings className="w-4 h-4 mr-2" />
                Create Class
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
              {classes.map((classItem) => (
              <Card key={classItem.id} className="shadow-elegant border-0 transition-smooth hover:shadow-glow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{classItem.name}</CardTitle>
                    <Badge variant="outline">Inactive</Badge>
                  </div>
                  <CardDescription>
                    {(classItem.enrollments?.[0]?.count || 0)} enrolled students
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Schedule:</span>
                      <span>{
                        Array.isArray(classItem.schedule) 
                          ? classItem.schedule[0]?.day || 'Not set'
                          : 'Not set'
                      }</span>
                    </div>
                    
                    <Button 
                      variant="primary"
                      className="w-full"
                      onClick={() => activateAttendance(classItem.id)}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Activate Attendance
                    </Button>
                  </div>
                </CardContent>
              </Card>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="mt-8 lg:mt-12">
          <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 lg:gap-4">
            <Button 
              variant="outline" 
              className="h-16 flex-col gap-2 text-xs sm:text-sm"
              onClick={() => navigate('/teacher/attendance-history')}
            >
              <History className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-xs">Attendance History</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-16 flex-col gap-2"
              onClick={() => {
                if (classes.length === 0) {
                  toast.error('No classes available');
                } else if (classes.length === 1) {
                  navigate(`/teacher/class-register/${classes[0].id}`);
                } else {
                  navigate('/teacher/class-selection?action=register');
                }
              }}
            >
              <Users className="w-5 h-5" />
              <span className="text-sm">View Register</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-16 flex-col gap-2 sm:hidden"
              onClick={sendAbsenceNotifications}
              disabled={sendingNotifications}
            >
              {sendingNotifications ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Bell className="w-4 h-4" />
              )}
              <span className="text-xs">Send Notifications</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherDashboard;