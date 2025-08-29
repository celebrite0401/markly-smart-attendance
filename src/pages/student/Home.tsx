import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, QrCode, Camera, LogOut, AlertCircle, CheckCircle, Loader2, BookOpen, History } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { getStudentClasses, Class } from '@/lib/api';
import { supabase } from '@/integrations/supabase/client';
import WeeklySchedule from '@/components/WeeklySchedule';
import MarklyLogo from '@/components/MarklyLogo';

interface AttendanceSession {
  id: string;
  className: string;
  teacherName: string;
  startTime: Date;
  endTime: Date;
  status: 'active' | 'ended';
  timeRemaining?: number;
}

interface ClassSchedule {
  id: string;
  name: string;
  time: string;
  status: 'completed' | 'active' | 'upcoming';
}

const StudentHome = () => {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const [activeSessions, setActiveSessions] = useState<AttendanceSession[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [todaysClasses, setTodaysClasses] = useState<ClassSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [attendanceRate, setAttendanceRate] = useState(0);
  const [totalClasses, setTotalClasses] = useState(0);
  const [recentAttendance, setRecentAttendance] = useState<any[]>([]);

  useEffect(() => {
    if (!user || !profile) {
      navigate('/login');
      return;
    }
    
    if (profile.role !== 'student') {
      navigate('/login');
      return;
    }

    fetchStudentData();
    
    // Set up real-time listening for active sessions and attendance changes
    const sessionsChannel = supabase
      .channel('student_sessions')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sessions',
          filter: `status=eq.active`
        },
        () => {
          fetchActiveSessions();
        }
      )
      .subscribe();

    // Listen to attendance changes to hide sessions immediately after check-in
    const attendanceChannel = supabase
      .channel('student_attendance')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance',
          filter: `student_id=eq.${user.id}`
        },
        () => {
          fetchActiveSessions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sessionsChannel);
      supabase.removeChannel(attendanceChannel);
    };
  }, [user, profile, navigate]);

  const fetchStudentData = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const enrollments = await getStudentClasses(user.id);
      const studentClasses = enrollments.map(enrollment => enrollment.class);
      setClasses(studentClasses);
      setTotalClasses(studentClasses.length);
      
      // Generate today's schedule from enrolled classes
      const today = new Date();
      const dayName = today.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      
      const todaySchedule = studentClasses
        .filter(cls => {
          const schedule = cls.schedule as any;
          return schedule && Array.isArray(schedule) && 
                 schedule.some((s: any) => s.day.toLowerCase() === dayName);
        })
        .map(cls => {
          const schedule = cls.schedule as any;
          const scheduleItem = schedule?.find((s: any) => s.day.toLowerCase() === dayName);
          return {
            id: cls.id,
            name: cls.name,
            time: scheduleItem?.time || '00:00',
            status: 'upcoming' as const
          };
        });
      
      setTodaysClasses(todaySchedule);
      
      // Fetch real attendance data
      await fetchAttendanceData(studentClasses.map(c => c.id));
      await fetchActiveSessions();
      
    } catch (error) {
      console.error('Error fetching student data:', error);
      toast.error('Failed to load classes');
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveSessions = async () => {
    if (!user) return;
    
    try {
      // First get user's enrollments to find their class IDs
      const { data: enrollments, error: enrollError } = await supabase
        .from('enrollments')
        .select('class_id')
        .eq('student_id', user.id);

      if (enrollError) throw enrollError;

      const classIds = enrollments?.map(e => e.class_id) || [];
      
      if (classIds.length === 0) {
        setActiveSessions([]);
        return;
      }

      // Get student's current attendance statuses
      const { data: attendanceRecords } = await supabase
        .from('attendance')
        .select('session_id, status')
        .eq('student_id', user.id)
        .in('status', ['present', 'pending']);
      
      const attendedSessionIds = new Set(attendanceRecords?.map(a => a.session_id) || []);

      // Get active sessions for enrolled classes, excluding already attended ones
      const { data: sessions, error } = await supabase
        .from('sessions')
        .select(`
          id,
          start_time,
          end_time,
          status,
          class:classes(
            id,
            name,
            teacher:profiles!classes_teacher_id_fkey(name)
          )
        `)
        .eq('status', 'active')
        .in('class_id', classIds);

      if (error) throw error;

      const activeSessions = sessions?.map(session => {
        const endTime = new Date(session.end_time);
        const now = new Date();
        const timeRemaining = Math.max(0, Math.floor((endTime.getTime() - now.getTime()) / 1000));
        
        return {
          id: session.id,
          className: session.class?.name || 'Unknown',
          teacherName: session.class?.teacher?.name || 'Unknown',
          startTime: new Date(session.start_time),
          endTime: endTime,
          status: session.status as 'active' | 'ended',
          timeRemaining
        };
      }).filter(s => s.timeRemaining > 0 && !attendedSessionIds.has(s.id)) || [];

      setActiveSessions(activeSessions);
    } catch (error) {
      console.error('Error fetching active sessions:', error);
    }
  };

  const fetchAttendanceData = async (classIds: string[]) => {
    if (!user || classIds.length === 0) return;
    
    try {
      // Fetch recent attendance records
      const { data: attendance, error } = await supabase
        .from('attendance')
        .select(`
          id,
          status,
          checkin_time,
          session:sessions(
            id,
            start_time,
            class:classes(name)
          )
        `)
        .eq('student_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50); // Get more records to account for grouping

      if (error) throw error;

      setRecentAttendance(attendance || []);
      
      // Group attendance records by class and date (same logic as in API)
      const attendanceByClassAndDate = new Map<string, {
        classId: string;
        className: string;
        date: string;
        status: 'present' | 'pending' | 'absent' | 'rejected';
        sessions: any[];
      }>();

      (attendance || []).forEach(att => {
        const classId = att.session?.class?.name || 'unknown';
        const sessionDate = att.session?.start_time ? new Date(att.session.start_time).toISOString().split('T')[0] : '';
        const key = `${classId}-${sessionDate}`;
        
        if (!sessionDate) return;

        const existing = attendanceByClassAndDate.get(key);
        
        if (!existing) {
          attendanceByClassAndDate.set(key, {
            classId,
            className: att.session?.class?.name || 'Unknown',
            date: sessionDate,
            status: att.status as any,
            sessions: [att]
          });
        } else {
          existing.sessions.push(att);
          
          // Priority: present > pending > absent > rejected
          const statusPriority = { present: 4, pending: 3, absent: 2, rejected: 1 };
          if (statusPriority[att.status as keyof typeof statusPriority] > statusPriority[existing.status]) {
            existing.status = att.status as any;
          }
        }
      });

      const dailyAttendance = Array.from(attendanceByClassAndDate.values());
      
      // Calculate real attendance rate based on days, not sessions
      const totalDays = dailyAttendance.length;
      const presentDays = dailyAttendance.filter(day => day.status === 'present').length;
      const rate = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;
      setAttendanceRate(rate);
      
    } catch (error) {
      console.error('Error fetching attendance data:', error);
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

  const joinSession = (sessionId: string) => {
    navigate(`/student/scan`);
  };

  const getStatusIcon = (status: 'completed' | 'active' | 'upcoming') => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'active':
        return <AlertCircle className="w-4 h-4 text-warning animate-pulse" />;
      case 'upcoming':
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: 'completed' | 'active' | 'upcoming') => {
    switch (status) {
      case 'completed':
        return 'bg-success/10 text-success';
      case 'active':
        return 'bg-warning/10 text-warning';
      case 'upcoming':
        return 'bg-muted text-muted-foreground';
    }
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
                  Student Dashboard
                </h1>
                <p className="text-sm text-muted-foreground">
                  Track your attendance and schedule
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
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Active Sessions Alert */}
        {activeSessions.length > 0 && (
          <div className="mb-8">
            <div className="bg-warning/10 border border-warning/20 rounded-lg p-6 animate-pulse-warning">
              <div className="flex items-center gap-3 mb-4">
                <AlertCircle className="w-6 h-6 text-warning" />
                <h2 className="text-lg font-semibold text-warning">Attendance Open!</h2>
              </div>
              
              {activeSessions.map((session) => (
                <div key={session.id} className="bg-card rounded-lg p-4 shadow-elegant">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-lg">{session.className}</h3>
                      <p className="text-muted-foreground">{session.teacherName}</p>
                    </div>
                    <Badge className="bg-warning/20 text-warning">
                      <Clock className="w-4 h-4 mr-1" />
                      {session.timeRemaining}s left
                    </Badge>
                  </div>
                  
                   <Button 
                     variant="primary"
                     size="lg"
                     className="w-full animate-pulse-success"
                     onClick={() => joinSession(session.id)}
                   >
                     <Camera className="w-5 h-5 mr-2" />
                     Scan QR to Join
                   </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Today's Schedule */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-6">Today's Classes</h2>
          
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Loading schedule...</span>
            </div>
          ) : todaysClasses.length === 0 ? (
            <div className="text-center py-8">
              <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No classes scheduled for today</p>
            </div>
          ) : (
            <div className="space-y-4">
              {todaysClasses.map((classItem) => (
                <Card key={classItem.id} className="shadow-elegant border-0">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {getStatusIcon(classItem.status)}
                        <div>
                          <h3 className="font-semibold text-lg">{classItem.name}</h3>
                          <p className="text-muted-foreground">{classItem.time}</p>
                        </div>
                      </div>
                      
                      <Badge className={getStatusColor(classItem.status)}>
                        {classItem.status.charAt(0).toUpperCase() + classItem.status.slice(1)}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-4 mb-6 lg:mb-8">
          <Card className="shadow-elegant border-0">
            <CardContent className="p-3 lg:p-4 text-center">
              <div className="w-6 h-6 lg:w-8 lg:h-8 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-2">
                <CheckCircle className="w-3 h-3 lg:w-4 lg:h-4 text-success" />
              </div>
              <p className="text-lg lg:text-2xl font-bold">{attendanceRate}%</p>
              <p className="text-xs text-muted-foreground">Attendance Rate</p>
            </CardContent>
          </Card>

          <Card className="shadow-elegant border-0">
            <CardContent className="p-4 text-center">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                <Clock className="w-4 h-4 text-primary" />
              </div>
              <p className="text-2xl font-bold">{todaysClasses.length}</p>
              <p className="text-xs text-muted-foreground">Classes Today</p>
            </CardContent>
          </Card>

          <Card className="shadow-elegant border-0">
            <CardContent className="p-4 text-center">
              <div className="w-8 h-8 rounded-full bg-warning/10 flex items-center justify-center mx-auto mb-2">
                <AlertCircle className="w-4 h-4 text-warning" />
              </div>
              <p className="text-2xl font-bold">{todaysClasses.filter(c => c.status === 'upcoming').length}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </CardContent>
          </Card>

          <Card className="shadow-elegant border-0">
            <CardContent className="p-4 text-center">
              <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-2">
                <QrCode className="w-4 h-4 text-success" />
              </div>
              <p className="text-2xl font-bold">{totalClasses}</p>
              <p className="text-xs text-muted-foreground">Total Classes</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              variant="outline"
              onClick={() => navigate('/student/scan')}
              className="w-full h-12"
            >
              <QrCode className="w-4 h-4 mr-2" />
              Scan QR Code
            </Button>
            
            <Button
              variant="outline"
              onClick={() => navigate('/student/attendance-tracker')}
              className="w-full h-12"
            >
              <BookOpen className="w-4 h-4 mr-2" />
              Attendance Tracker
            </Button>
            
            <Button
              variant="outline"
              onClick={() => navigate('/student/attendance-history')}
              className="w-full h-12"
            >
              <History className="w-4 h-4 mr-2" />
              Attendance History
            </Button>
          </div>
        </div>

        {/* Weekly Schedule */}
        <div className="mb-8">
          <WeeklySchedule 
            showSectionFilter={false} 
            userRole="student" 
            studentSection={profile?.section || undefined}
          />
        </div>

        {/* Recent Attendance */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Recent Attendance</h3>
          </div>
          {recentAttendance.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No attendance records yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentAttendance.slice(0, 5).map((record) => {
                const getStatusIcon = (status: string) => {
                  switch (status) {
                    case 'present':
                      return <CheckCircle className="w-5 h-5 text-success" />;
                    case 'pending':
                      return <AlertCircle className="w-5 h-5 text-warning" />;
                    case 'rejected':
                      return <AlertCircle className="w-5 h-5 text-destructive" />;
                    default:
                      return <Clock className="w-5 h-5 text-muted-foreground" />;
                  }
                };
                
                const getStatusBadge = (status: string) => {
                  switch (status) {
                    case 'present':
                      return <Badge className="bg-success/10 text-success">Present</Badge>;
                    case 'pending':
                      return <Badge className="bg-warning/10 text-warning">Pending</Badge>;
                    case 'rejected':
                      return <Badge className="bg-destructive/10 text-destructive">Rejected</Badge>;
                    default:
                      return <Badge className="bg-muted text-muted-foreground">Absent</Badge>;
                  }
                };

                return (
                  <Card key={record.id} className="shadow-elegant border-0">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(record.status)}
                          <div>
                            <p className="font-medium">{record.session?.class?.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {record.checkin_time 
                                ? new Date(record.checkin_time).toLocaleString()
                                : new Date(record.session?.start_time).toLocaleString()
                              }
                            </p>
                          </div>
                        </div>
                        {getStatusBadge(record.status)}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentHome;