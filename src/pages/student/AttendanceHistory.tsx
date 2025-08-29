import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, History, Loader2, CheckCircle, AlertCircle, Clock, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { getStudentAttendanceHistory } from '@/lib/api';
import { format } from 'date-fns';

interface AttendanceRecord {
  id: string;
  date: string;
  className: string;
  teacherName: string;
  status: 'present' | 'pending' | 'absent' | 'rejected';
  checkinTime?: string;
  faceScore?: number;
}

const StudentAttendanceHistory = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    loadAttendanceHistory();
  }, [user, navigate]);

  const loadAttendanceHistory = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const historyData = await getStudentAttendanceHistory(user.id);
      console.log('Attendance history data:', historyData);
      setHistory(historyData);
    } catch (error: any) {
      console.error('Error loading attendance history:', error);
      toast.error('Failed to load attendance history');
    } finally {
      setLoading(false);
    }
  };

  const getAttendanceStats = () => {
    const stats = history.reduce((acc, record) => {
      acc[record.status]++;
      return acc;
    }, { present: 0, pending: 0, absent: 0, rejected: 0 });
    
    return stats;
  };

  const getAttendancePercentage = () => {
    const total = history.length;
    if (total === 0) return 0;
    
    const present = history.filter(record => record.status === 'present').length;
    return Math.round((present / total) * 100);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present':
        return <CheckCircle className="w-5 h-5 text-success" />;
      case 'pending':
        return <AlertCircle className="w-5 h-5 text-warning" />;
      case 'rejected':
        return <X className="w-5 h-5 text-destructive" />;
      default:
        return <Clock className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present':
        return 'bg-success/10 text-success';
      case 'pending':
        return 'bg-warning/10 text-warning';
      case 'rejected':
        return 'bg-destructive/10 text-destructive';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading your attendance...</span>
      </div>
    );
  }

  const stats = getAttendanceStats();
  const attendancePercentage = getAttendancePercentage();

  return (
    <div className="min-h-screen gradient-subtle">
      {/* Header */}
      <div className="bg-card/80 backdrop-blur-sm border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate('/student/home')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
              <div>
                <h1 className="text-xl font-semibold flex items-center gap-2">
                  <History className="w-5 h-5" />
                  My Attendance
                </h1>
                <p className="text-sm text-muted-foreground">
                  View your attendance record across all classes
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {history.length > 0 ? (
            <>
              {/* Attendance Summary */}
              <Card className="shadow-elegant border-0 mb-6">
                <CardHeader>
                  <CardTitle>Attendance Summary</CardTitle>
                </CardHeader>
                 <CardContent>
                   <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                     <div className="text-center">
                       <div className="text-3xl font-bold text-primary">{attendancePercentage}%</div>
                       <div className="text-sm text-muted-foreground">Attendance Rate</div>
                     </div>
                     <div className="text-center">
                       <div className="text-2xl font-bold text-success">{stats.present}</div>
                       <div className="text-sm text-muted-foreground">Days Present</div>
                     </div>
                     <div className="text-center">
                       <div className="text-2xl font-bold text-warning">{stats.pending}</div>
                       <div className="text-sm text-muted-foreground">Days Pending</div>
                     </div>
                     <div className="text-center">
                       <div className="text-2xl font-bold text-muted-foreground">{stats.absent}</div>
                       <div className="text-sm text-muted-foreground">Days Absent</div>
                     </div>
                     <div className="text-center">
                       <div className="text-2xl font-bold text-destructive">{stats.rejected}</div>
                       <div className="text-sm text-muted-foreground">Days Rejected</div>
                     </div>
                   </div>
                 </CardContent>
              </Card>

              {/* Attendance Progress */}
              <Card className="shadow-elegant border-0 mb-6">
                <CardHeader>
                  <CardTitle>Attendance Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                     <div className="flex items-center justify-between">
                       <span className="text-sm font-medium">Present Days</span>
                       <span className="text-sm text-muted-foreground">
                         {stats.present} of {history.length} days
                       </span>
                     </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-success h-2 rounded-full transition-all duration-300"
                        style={{ width: `${history.length ? (stats.present / history.length) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

               {/* Attendance History List */}
               <Card className="shadow-elegant border-0">
                 <CardHeader>
                   <CardTitle>Daily Attendance History</CardTitle>
                 </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {history.map((record) => (
                      <div key={record.id} className="flex items-center justify-between p-4 rounded-lg border">
                        <div className="flex items-center gap-4">
                          {getStatusIcon(record.status)}
                          <div>
                            <h3 className="font-semibold">{record.className}</h3>
                            <p className="text-sm text-muted-foreground">
                              {record.teacherName}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(record.date), 'MMM dd, yyyy')}
                              {record.checkinTime && ` • ${format(new Date(record.checkinTime), 'h:mm a')}`}
                            </p>
                            {record.faceScore && (
                              <p className="text-xs text-muted-foreground">
                                Face Score: {record.faceScore.toFixed(2)}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        <Badge className={getStatusColor(record.status)}>
                          {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="shadow-elegant border-0">
              <CardContent className="pt-6 text-center">
                <History className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-semibold mb-2">No Attendance Records</h3>
                <p className="text-muted-foreground mb-4">
                  You don't have any attendance records yet. Join a class session to start building your attendance history.
                </p>
                <Button onClick={() => navigate('/student/home')}>
                  Go to Home
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentAttendanceHistory;