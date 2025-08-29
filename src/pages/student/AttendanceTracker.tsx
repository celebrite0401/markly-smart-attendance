import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { ArrowLeft, BookOpen, Calendar as CalendarIcon, TrendingUp, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { getStudentAttendanceStats, getStudentAttendanceHistory } from '@/lib/api';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';

interface AttendanceStats {
  classId: string;
  className: string;
  totalSessions: number; // Now represents total days with classes, not individual sessions
  presentCount: number; // Days present
  absentCount: number; // Days absent
  pendingCount: number; // Days pending
  rejectedCount: number; // Days rejected
  attendancePercentage: number;
  recentSessions: Array<{
    id: string;
    date: string;
    status: 'present' | 'absent' | 'pending' | 'rejected';
    faceScore?: number;
  }>;
}

interface AttendanceRecord {
  id: string;
  date: string;
  className: string;
  status: 'present' | 'absent' | 'pending' | 'rejected';
  checkinTime?: string;
  faceScore?: number;
  teacherName: string;
}

const StudentAttendanceTracker = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [stats, setStats] = useState<AttendanceStats[]>([]);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());

  useEffect(() => {
    if (!user || !profile || profile.role !== 'student') {
      navigate('/login');
      return;
    }
    
    fetchAttendanceData();
  }, [user, profile, navigate]);

  const fetchAttendanceData = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const [statsData, historyData] = await Promise.all([
        getStudentAttendanceStats(user.id),
        getStudentAttendanceHistory(user.id)
      ]);
      
      setStats(statsData);
      setHistory(historyData);
    } catch (error) {
      console.error('Error fetching attendance data:', error);
      toast.error('Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'absent':
        return <XCircle className="w-4 h-4 text-destructive" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-warning" />;
      case 'rejected':
        return <AlertTriangle className="w-4 h-4 text-destructive" />;
      default:
        return <XCircle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present':
        return 'bg-success/10 text-success';
      case 'absent':
        return 'bg-destructive/10 text-destructive';
      case 'pending':
        return 'bg-warning/10 text-warning';
      case 'rejected':
        return 'bg-destructive/10 text-destructive';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getAttendanceForDate = (date: Date) => {
    return history.filter(record => 
      isSameDay(parseISO(record.date), date)
    );
  };

  const getOverallStats = () => {
    const totalDays = stats.reduce((sum, stat) => sum + stat.totalSessions, 0); // totalSessions now represents total days
    const totalPresent = stats.reduce((sum, stat) => sum + stat.presentCount, 0);
    const overallPercentage = totalDays > 0 ? (totalPresent / totalDays) * 100 : 0;
    
    return {
      totalSessions: totalDays, // Rename for clarity, but represents total class days
      totalPresent,
      overallPercentage: Math.round(overallPercentage * 100) / 100
    };
  };

  const getAttendanceGrade = (percentage: number) => {
    if (percentage >= 90) return { grade: 'Excellent', color: 'text-success' };
    if (percentage >= 80) return { grade: 'Good', color: 'text-primary' };
    if (percentage >= 70) return { grade: 'Average', color: 'text-warning' };
    return { grade: 'Poor', color: 'text-destructive' };
  };

  const monthDays = eachDayOfInterval({
    start: startOfMonth(selectedMonth),
    end: endOfMonth(selectedMonth)
  });

  const overallStats = getOverallStats();
  const overallGrade = getAttendanceGrade(overallStats.overallPercentage);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading attendance data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-subtle">
      {/* Header */}
      <div className="bg-card/80 backdrop-blur-sm border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => navigate('/student/home')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
            <div className="text-center">
              <h1 className="text-xl font-semibold">Attendance Tracker</h1>
              <p className="text-sm text-muted-foreground">Track your attendance across all subjects</p>
            </div>
            <div className="text-right">
              <div className={`text-lg font-bold ${overallGrade.color}`}>
                {overallStats.overallPercentage}%
              </div>
              <p className="text-sm text-muted-foreground">{overallGrade.grade}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Overall Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="shadow-elegant border-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary" />
                Total Class Days
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">
                {overallStats.totalSessions}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Days with classes
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-elegant border-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-success" />
                Present Days
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-success">
                {overallStats.totalPresent}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Days attended
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-elegant border-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Overall Percentage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${overallGrade.color}`}>
                {overallStats.overallPercentage}%
              </div>
              <p className={`text-sm mt-1 ${overallGrade.color}`}>
                {overallGrade.grade}
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="subjects" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="subjects">By Subject</TabsTrigger>
            <TabsTrigger value="calendar">Calendar View</TabsTrigger>
          </TabsList>

          <TabsContent value="subjects" className="space-y-6">
            {stats.length === 0 ? (
              <Card className="shadow-elegant border-0">
                <CardContent className="text-center py-8">
                  <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Attendance Data</h3>
                  <p className="text-muted-foreground">
                    You haven't attended any sessions yet. Check back after your first class!
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6">
                {stats.map((subjectStat) => {
                  const grade = getAttendanceGrade(subjectStat.attendancePercentage);
                  return (
                    <Card key={subjectStat.classId} className="shadow-elegant border-0">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{subjectStat.className}</CardTitle>
                          <Badge className={getStatusColor('present')}>
                            {subjectStat.attendancePercentage}%
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                          <div>
                            <div className="text-2xl font-bold text-primary">
                              {subjectStat.totalSessions}
                            </div>
                            <p className="text-sm text-muted-foreground">Class Days</p>
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-success">
                              {subjectStat.presentCount}
                            </div>
                            <p className="text-sm text-muted-foreground">Present</p>
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-destructive">
                              {subjectStat.absentCount}
                            </div>
                            <p className="text-sm text-muted-foreground">Absent</p>
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-warning">
                              {subjectStat.pendingCount}
                            </div>
                            <p className="text-sm text-muted-foreground">Pending</p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Attendance Rate</span>
                            <span className={grade.color}>{grade.grade}</span>
                          </div>
                          <Progress 
                            value={subjectStat.attendancePercentage} 
                            className="h-2"
                          />
                        </div>

                        {subjectStat.recentSessions.length > 0 && (
                          <div>
                            <h4 className="font-medium mb-3">Recent Class Days</h4>
                            <div className="space-y-2">
                              {subjectStat.recentSessions.slice(0, 5).map((session) => (
                                <div
                                  key={session.id}
                                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                                >
                                  <div className="flex items-center gap-3">
                                    {getStatusIcon(session.status)}
                                    <span className="text-sm">
                                      {format(parseISO(session.date), 'MMM dd, yyyy')}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge className={getStatusColor(session.status)}>
                                      {session.status}
                                    </Badge>
                                    {session.faceScore && (
                                      <span className="text-xs text-muted-foreground">
                                        Score: {session.faceScore.toFixed(2)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="calendar" className="space-y-6">
            <Card className="shadow-elegant border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5" />
                  Attendance Calendar
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => date && setSelectedDate(date)}
                      month={selectedMonth}
                      onMonthChange={setSelectedMonth}
                      className="rounded-md border"
                      modifiers={{
                        present: monthDays.filter(day => 
                          getAttendanceForDate(day).some(record => record.status === 'present')
                        ),
                        absent: monthDays.filter(day => 
                          getAttendanceForDate(day).some(record => record.status === 'absent')
                        ),
                        pending: monthDays.filter(day => 
                          getAttendanceForDate(day).some(record => record.status === 'pending')
                        ),
                      }}
                      modifiersStyles={{
                        present: { backgroundColor: 'hsl(var(--success))', color: 'white' },
                        absent: { backgroundColor: 'hsl(var(--destructive))', color: 'white' },
                        pending: { backgroundColor: 'hsl(var(--warning))', color: 'white' },
                      }}
                    />
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-3">
                        {format(selectedDate, 'MMMM dd, yyyy')} Classes
                      </h4>
                      {getAttendanceForDate(selectedDate).length === 0 ? (
                        <p className="text-muted-foreground text-sm">
                          No classes on this date
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {getAttendanceForDate(selectedDate).map((record) => (
                            <div
                              key={record.id}
                              className="flex items-center justify-between p-3 rounded-lg border bg-card"
                            >
                              <div className="flex items-center gap-3">
                                {getStatusIcon(record.status)}
                                <div>
                                  <p className="font-medium">{record.className}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {record.teacherName}
                                  </p>
                                  {record.checkinTime && (
                                    <p className="text-xs text-muted-foreground">
                                      {format(parseISO(record.checkinTime), 'h:mm a')}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <Badge className={getStatusColor(record.status)}>
                                {record.status}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-medium">Legend</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded bg-success"></div>
                          <span>Present</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded bg-destructive"></div>
                          <span>Absent</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded bg-warning"></div>
                          <span>Pending</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded bg-muted"></div>
                          <span>No Session</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default StudentAttendanceTracker;