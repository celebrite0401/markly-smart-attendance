import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Clock, Users, QrCode, Plus, Download, Eye, Loader2, Bell, UserX } from 'lucide-react';
import { toast } from 'sonner';
import QRCodeCanvas from '@/components/QRCodeCanvas';
import AttendanceList from '@/components/AttendanceList';
import { createSession, getSessionAttendance, endSession as endSessionAPI, generateQRToken } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface SessionData {
  id: string;
  classId: string;
  className: string;
  startTime: Date;
  endTime: Date;
  extended: boolean;
  remainingTime: number;
  students: Array<{
    id: string;
    name: string;
    status: 'present' | 'pending' | 'absent' | 'rejected';
    checkInTime?: Date;
    faceScore?: number;
    photoUrl?: string;
    liveness?: boolean;
  }>;
}

const SessionView = () => {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [session, setSession] = useState<SessionData | null>(null);
  const [currentToken, setCurrentToken] = useState<string>('');
  const [isExtended, setIsExtended] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string>('');
  const [sendingNotifications, setSendingNotifications] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);

  const initializeSession = async () => {
    if (!classId || !user) return;

    try {
      setLoading(true);
      
      // Create a new session
      const newSession = await createSession(classId, user.id);
      setSessionId(newSession.id);
      
      const sessionData: SessionData = {
        id: newSession.id,
        classId: classId,
        className: 'Class Session', // Will be updated when we get class details
        startTime: new Date(newSession.start_time),
        endTime: new Date(newSession.end_time),
        extended: newSession.extended || false,
        remainingTime: Math.max(0, Math.floor((new Date(newSession.end_time).getTime() - Date.now()) / 1000)),
        students: []
      };

      setSession(sessionData);
      
      // Generate initial QR token
      if (newSession.qr_secret) {
        const token = generateQRToken(newSession.id, newSession.qr_secret);
        setCurrentToken(token);
      }

      // Load attendance data
      loadAttendanceData(newSession.id);

      // Start countdown timer
      const countdown = setInterval(() => {
        setSession(prev => {
          if (!prev) return null;
          
          const newRemainingTime = prev.remainingTime - 1;
          
          if (newRemainingTime <= 0) {
            clearInterval(countdown);
            // Auto-end session when time runs out
            endSessionAPI(newSession.id).catch(console.error);
            setSessionEnded(true);
            toast.info('Session ended automatically');
            return { ...prev, remainingTime: 0 };
          }
          
          return { ...prev, remainingTime: newRemainingTime };
        });
      }, 1000);

      // Rotate QR code every 10 seconds
      const tokenRotation = setInterval(() => {
        if (newSession.qr_secret) {
          const token = generateQRToken(newSession.id, newSession.qr_secret);
          setCurrentToken(token);
        }
      }, 10000);

      return () => {
        clearInterval(countdown);
        clearInterval(tokenRotation);
      };

    } catch (error) {
      console.error('Error initializing session:', error);
      toast.error('Failed to start session');
      navigate('/teacher/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const loadAttendanceData = async (sessionId: string) => {
    try {
      console.log('Loading attendance data for session:', sessionId);
      const attendance = await getSessionAttendance(sessionId);
      console.log('Received attendance data:', attendance.length, 'records');
      
      const students = attendance.map(record => ({
        id: record.id,
        name: record.student?.name || 'Unknown Student',
        status: record.status as 'present' | 'pending' | 'absent' | 'rejected',
        checkInTime: record.checkin_time ? new Date(record.checkin_time) : undefined,
        faceScore: record.face_score || undefined,
        photoUrl: record.photo_url || undefined,
        liveness: record.liveness || false,
      }));

      console.log('Mapped students:', students.map(s => ({ name: s.name, status: s.status })));
      console.log('Status counts about to be calculated from:', students.length, 'students');

      setSession(prev => {
        if (!prev) return null;
        const updated = { ...prev, students };
        console.log('Updated session with new students count:', students.length);
        
        // Debug status counts
        const counts = students.reduce((acc, student) => {
          acc[student.status] = (acc[student.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        console.log('Calculated status counts:', counts);
        
        return updated;
      });
    } catch (error) {
      console.error('Error loading attendance:', error);
      toast.error('Failed to load attendance data');
    }
  };

  const refreshAttendance = useCallback(() => {
    if (sessionId) {
      loadAttendanceData(sessionId);
    }
  }, [sessionId]);

  useEffect(() => {
    initializeSession();
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    console.log('Setting up realtime subscription for session:', sessionId);

    const channel = supabase
      .channel(`attendance-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance',
          filter: `session_id=eq.${sessionId}`
        },
        (payload) => {
          console.log('Attendance change detected:', payload);
          console.log('Payload details:', {
            eventType: payload.eventType,
            old: payload.old,
            new: payload.new,
            sessionId: sessionId
          });
          refreshAttendance();
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to attendance changes');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Realtime subscription failed - trying to reconnect');
          setTimeout(() => {
            console.log('Attempting to reload attendance after connection error');
            refreshAttendance();
          }, 2000);
        }
      });

    return () => {
      console.log('Cleaning up realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [sessionId, refreshAttendance]);


  const extendSession = () => {
    if (isExtended) {
      toast.error('Session can only be extended once');
      return;
    }

    setSession(prev => {
      if (!prev) return null;
      return {
        ...prev,
        remainingTime: prev.remainingTime + 30,
        extended: true,
      };
    });
    setIsExtended(true);
    toast.success('Session extended by 30 seconds');
  };

  const endSessionHandler = async () => {
    if (!sessionId) return;

    try {
      await endSessionAPI(sessionId);
      // Immediately reflect in UI
      setSession(prev => (prev ? { ...prev, remainingTime: 0 } : prev));
      setSessionEnded(true);
      toast.success('Session ended successfully');
    } catch (error) {
      console.error('Error ending session:', error);
      toast.error('Failed to end session');
    }
  };

  const sendAbsenceNotifications = async () => {
    if (!session) return;

    try {
      setSendingNotifications(true);
      toast.info('Sending notifications to absent students...');
      
      const { data, error } = await supabase.functions.invoke('send-absence-notifications');
      
      if (error) {
        throw error;
      }
      
      const result = data;
      
      if (result.message === 'No recently ended sessions found') {
        toast.info('No recently ended sessions found to send notifications for.');
      } else {
        toast.success(
          `Notifications sent! Processed ${result.sessionsProcessed || 0} sessions, sent ${result.notificationsSent || 0} notifications.`
        );
      }
      
    } catch (error: any) {
      console.error('Error sending absence notifications:', error);
      toast.error(`Failed to send notifications: ${error.message}`);
    } finally {
      setSendingNotifications(false);
    }
  };

  const getAbsentees = () => {
    return session?.students.filter(student => 
      student.status === 'absent' || student.status === 'rejected'
    ) || [];
  };

  const exportCSV = () => {
    if (!session) return;
    
    const csvContent = [
      ['Name', 'Status', 'Check-in Time', 'Face Score'].join(','),
      ...session.students.map(student => [
        student.name,
        student.status,
        student.checkInTime?.toISOString() || '',
        student.faceScore?.toString() || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-${session.className}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success('Attendance exported successfully');
  };

  const getStatusCounts = () => {
    const counts = {
      present: 0,
      pending: 0,
      absent: 0,
      rejected: 0
    };

    console.log('getStatusCounts called with session:', session?.students?.length, 'students');

    session?.students.forEach(student => {
      const status = student.status;
      console.log(`Student ${student.name}: ${status}`);
      if (status === 'present') {
        counts.present++;
      } else if (status === 'pending') {
        counts.pending++;
      } else if (status === 'rejected') {
        counts.rejected++;
      } else {
        counts.absent++;
      }
    });

    console.log('Final status counts:', counts);
    return counts;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgressPercentage = () => {
    if (!session) return 0;
    const totalTime = 90 + (session.extended ? 30 : 0);
    return ((totalTime - session.remainingTime) / totalTime) * 100;
  };

  if (loading || !session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Starting session...</span>
      </div>
    );
  }

  const statusCounts = getStatusCounts();
  const isActive = session.remainingTime > 0;
  const absentees = getAbsentees();

  return (
    <div className="min-h-screen gradient-subtle">
      {/* Header */}
      <div className="bg-card/80 backdrop-blur-sm border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate('/teacher/dashboard')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
              <div>
                <h1 className="text-xl font-semibold">{session.className}</h1>
                <p className="text-sm text-muted-foreground">
                  {isActive ? 'Active Session' : 'Session Ended'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={exportCSV}>
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
              {isActive && (
                <Button variant="destructive" onClick={endSessionHandler}>
                  End Session
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - QR Code & Timer */}
          <div className="lg:col-span-1">
            <Card className="shadow-elegant border-0 mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <QrCode className="w-5 h-5" />
                  Attendance QR Code
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                {isActive ? (
                  <div>
                    <div className="mb-4">
                      <QRCodeCanvas token={currentToken} />
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      QR code refreshes every 10 seconds
                    </p>
                    <div className="text-center mb-4">
                      <div className={`text-4xl font-bold ${session.remainingTime <= 30 ? 'text-destructive animate-countdown-pulse' : 'text-primary'}`}>
                        {formatTime(session.remainingTime)}
                      </div>
                      <p className="text-sm text-muted-foreground">Time remaining</p>
                    </div>
                    <Progress 
                      value={getProgressPercentage()} 
                      className="mb-4"
                    />
                    {!isExtended && (
                      <Button 
                        variant="warning" 
                        onClick={extendSession}
                        className="w-full"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Extend +30s
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="py-8 text-center text-muted-foreground">
                    <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Session has ended</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Stats */}
            <Card className="shadow-elegant border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Live Stats
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-success">{statusCounts.present}</div>
                    <div className="text-sm text-muted-foreground">Present</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-warning">{statusCounts.pending}</div>
                    <div className="text-sm text-muted-foreground">Pending</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-muted-foreground">{statusCounts.absent}</div>
                    <div className="text-sm text-muted-foreground">Absent</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-destructive">{statusCounts.rejected}</div>
                    <div className="text-sm text-muted-foreground">Rejected</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Absentees Card - Only show when session ended and there are absentees */}
            {sessionEnded && absentees.length > 0 && (
              <Card className="shadow-elegant border-0 mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-warning">
                    <UserX className="w-5 h-5" />
                    Absent Students ({absentees.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 mb-4">
                    {absentees.map((student) => (
                      <div key={student.id} className="flex items-center gap-2 text-sm">
                        <div className="w-2 h-2 rounded-full bg-warning"></div>
                        <span>{student.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {student.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                  <Button 
                    onClick={sendAbsenceNotifications}
                    disabled={sendingNotifications}
                    className="w-full"
                    variant="default"
                  >
                    {sendingNotifications ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Bell className="w-4 h-4 mr-2" />
                        Send Notifications to Absentees
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Student List */}
          <div className="lg:col-span-2">
            <AttendanceList students={session.students} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionView;