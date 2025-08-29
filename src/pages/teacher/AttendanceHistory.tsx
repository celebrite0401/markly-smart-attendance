import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Users, CheckCircle, Clock, XCircle, AlertCircle, Bell, BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getTeacherAttendanceHistory, getTeacherClasses } from '@/lib/api';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import AttendanceHistoryList from '@/components/AttendanceHistoryList';
import EditAttendanceDialog from '@/components/EditAttendanceDialog';

interface LocalAttendanceRecord {
  id: string;
  student_id: string;
  session_id: string;
  student_name: string;
  student_email?: string;
  student_roll_number?: string;
  status: 'present' | 'pending' | 'absent' | 'rejected';
  checkin_time?: string;
  face_score?: number;
  photo_url?: string;
  liveness?: boolean;
  review_reason?: string;
  created_at: string;
  student?: {
    name: string;
    email: string;
  };
}

interface LocalSessionWithAttendance {
  id: string;
  class_id: string;
  class_name: string;
  start_time: string;
  end_time: string;
  status: string;
  total_enrolled: number;
  attendance_records: LocalAttendanceRecord[];
  // Compatibility with AttendanceHistoryList
  class: {
    id: string;
    name: string;
  };
  attendance: LocalAttendanceRecord[];
}

interface TodaysClass {
  id: string;
  name: string;
  description: string;
  enrolled_count: number;
  latest_session?: {
    id: string;
    start_time: string;
    end_time: string;
    status: string;
    present_count: number;
    absent_count: number;
  };
}

const TeacherAttendanceHistory = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<LocalSessionWithAttendance[]>([]);
  const [todaysClasses, setTodaysClasses] = useState<TodaysClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingNotifications, setSendingNotifications] = useState<{[key: string]: boolean}>({});
  const [selectedAttendance, setSelectedAttendance] = useState<LocalAttendanceRecord | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    
    loadAttendanceData();
  }, [user, navigate]);

  const loadAttendanceData = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      console.log('Loading attendance data for teacher:', user.id);
      
      // Load today's classes with latest session info
      const classes = await getTeacherClasses(user.id);
      const today = new Date().toISOString().split('T')[0];
      
      const todaysClassesWithSessions = await Promise.all(
        classes.map(async (cls) => {
          // Get enrollment count for the class
          const { data: enrollments } = await supabase
            .from('enrollments')
            .select('id')
            .eq('class_id', cls.id);

          const enrollmentCount = enrollments?.length || 0;
          const { data: latestSession } = await supabase
            .from('sessions')
            .select(`
              id,
              start_time,
              end_time,
              status,
              attendance(status)
            `)
            .eq('class_id', cls.id)
            .gte('start_time', `${today}T00:00:00`)
            .lte('start_time', `${today}T23:59:59`)
            .order('start_time', { ascending: false })
            .limit(1)
            .single();

          const sessionData = latestSession ? {
            id: latestSession.id,
            start_time: latestSession.start_time,
            end_time: latestSession.end_time,
            status: latestSession.status,
            present_count: latestSession.attendance?.filter((a: any) => a.status === 'present').length || 0,
            absent_count: latestSession.attendance?.filter((a: any) => ['absent', 'rejected'].includes(a.status)).length || 0,
          } : undefined;

          return {
            id: cls.id,
            name: cls.name,
            description: cls.description || '',
            enrolled_count: enrollmentCount,
            latest_session: sessionData
          };
        })
      );

      setTodaysClasses(todaysClassesWithSessions);
      
      // Load recent sessions history
      const historyData = await getTeacherAttendanceHistory(user.id);
      const transformedSessions = historyData.slice(0, 20).map((session: any): LocalSessionWithAttendance => ({
        id: session.session_id,
        class_id: session.class_id,
        class_name: session.class_name,
        start_time: session.session_start_time,
        end_time: session.session_end_time,
        status: session.session_status,
        total_enrolled: session.total_enrolled,
        attendance_records: session.attendance_records || [],
        // Compatibility with AttendanceHistoryList
        class: {
          id: session.class_id,
          name: session.class_name
        },
        attendance: session.attendance_records || []
      }));
      
      setSessions(transformedSessions);
    } catch (error) {
      console.error('Error loading attendance data:', error);
      toast.error('Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  };

  const sendClassNotifications = async (classId: string, className: string) => {
    try {
      setSendingNotifications(prev => ({ ...prev, [classId]: true }));
      toast.info(`Sending absence notifications for ${className}...`);

      const { data, error } = await supabase.functions.invoke('send-all-absence-notifications', {
        body: { teacherId: user?.id }
      });

      if (error) throw error;

      if (data?.started) {
        toast.success(`Notification job started for ${className}. Emails will be sent shortly.`);
      } else {
        toast.success(`Notifications sent for ${className}!`);
      }
    } catch (error: any) {
      console.error('Error sending notifications:', error);
      toast.error(`Failed to send notifications: ${error.message}`);
    } finally {
      setSendingNotifications(prev => ({ ...prev, [classId]: false }));
    }
  };

  const handleEditAttendance = (attendance: LocalAttendanceRecord) => {
    setSelectedAttendance(attendance);
  };

  const handleAttendanceUpdated = () => {
    setSelectedAttendance(null);
    loadAttendanceData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading attendance data...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-subtle">
      {/* Header */}
      <div className="bg-card/80 backdrop-blur-sm border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/teacher/dashboard')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <div>
              <h1 className="text-xl font-semibold">Attendance History</h1>
              <p className="text-sm text-muted-foreground">Review classes and sessions</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Today's Classes */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <BookOpen className="w-6 h-6" />
            Today's Classes
          </h2>
          
          {todaysClasses.length === 0 ? (
            <Card className="shadow-elegant border-0">
              <CardContent className="p-8 text-center">
                <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No classes scheduled for today</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {todaysClasses.map((cls) => (
                <Card key={cls.id} className="shadow-elegant border-0">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-lg">{cls.name}</h3>
                          <Badge variant="outline">
                            {cls.enrolled_count} students
                          </Badge>
                        </div>
                        {cls.description && (
                          <p className="text-sm text-muted-foreground mb-3">{cls.description}</p>
                        )}
                        
                        {cls.latest_session ? (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Session Time</p>
                              <p className="font-medium">
                                {new Date(cls.latest_session.start_time).toLocaleTimeString([], { 
                                  hour: '2-digit', minute: '2-digit' 
                                })}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Status</p>
                              <Badge variant={cls.latest_session.status === 'active' ? 'default' : 'secondary'}>
                                {cls.latest_session.status}
                              </Badge>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Present</p>
                              <p className="font-medium text-success">{cls.latest_session.present_count}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Absent</p>
                              <p className="font-medium text-destructive">{cls.latest_session.absent_count}</p>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No session conducted today</p>
                        )}
                      </div>

                      <div className="ml-4">
                        <Button
                          onClick={() => sendClassNotifications(cls.id, cls.name)}
                          disabled={sendingNotifications[cls.id] || !cls.latest_session}
                          variant="outline"
                          size="sm"
                        >
                          {sendingNotifications[cls.id] ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : (
                            <Bell className="w-4 h-4 mr-2" />
                          )}
                          Notify Absentees
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Recent Sessions */}
        <div>
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Clock className="w-6 h-6" />
            Recent Sessions
          </h2>
          
          {sessions.length === 0 ? (
            <Card className="shadow-elegant border-0">
              <CardContent className="p-8 text-center">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Sessions Yet</h3>
                <p className="text-muted-foreground">Start a session to begin tracking attendance</p>
              </CardContent>
            </Card>
          ) : (
            <AttendanceHistoryList 
              sessions={sessions as any} 
              isTeacher={true}
              onEditAttendance={handleEditAttendance as any}
            />
          )}
        </div>

        {/* Edit Dialog */}
        {selectedAttendance && (
          <EditAttendanceDialog
            attendance={selectedAttendance as any}
            onClose={() => setSelectedAttendance(null)}
            onUpdate={handleAttendanceUpdated}
          />
        )}
      </div>
    </div>
  );
};

export default TeacherAttendanceHistory;