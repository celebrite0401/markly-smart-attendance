import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, Clock, X, Edit2, Calendar, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface AttendanceRecord {
  id: string;
  student_id: string;
  session_id: string;
  status: 'present' | 'pending' | 'absent' | 'rejected';
  checkin_time?: string;
  face_score?: number;
  liveness?: boolean;
  photo_url?: string;
  review_reason?: string;
  student?: {
    name: string;
    email: string;
  };
}

interface SessionWithAttendance {
  id: string;
  start_time: string;
  end_time: string;
  status: 'active' | 'ended';
  class: {
    id: string;
    name: string;
  };
  attendance: AttendanceRecord[];
}

interface AttendanceHistoryListProps {
  sessions: SessionWithAttendance[];
  isTeacher?: boolean;
  onEditAttendance?: (attendance: AttendanceRecord) => void;
}

const AttendanceHistoryList = ({ 
  sessions, 
  isTeacher = false, 
  onEditAttendance 
}: AttendanceHistoryListProps) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'pending':
        return <AlertCircle className="w-4 h-4 text-warning" />;
      case 'absent':
        return <Clock className="w-4 h-4 text-muted-foreground" />;
      case 'rejected':
        return <X className="w-4 h-4 text-destructive" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present':
        return 'bg-success/10 text-success';
      case 'pending':
        return 'bg-warning/10 text-warning';
      case 'absent':
        return 'bg-muted text-muted-foreground';
      case 'rejected':
        return 'bg-destructive/10 text-destructive';
    }
  };

  const getAttendanceStats = (attendance: AttendanceRecord[]) => {
    return attendance.reduce((stats, record) => {
      stats[record.status]++;
      return stats;
    }, { present: 0, pending: 0, absent: 0, rejected: 0 });
  };

  if (!sessions.length) {
    return (
      <Card className="shadow-elegant border-0">
        <CardContent className="pt-6 text-center">
          <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">No attendance records found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {sessions.map((session) => {
        const stats = getAttendanceStats(session.attendance);
        const sessionDate = new Date(session.start_time);
        const isValidDate = !isNaN(sessionDate.getTime());
        
        return (
          <Card key={session.id} className="shadow-elegant border-0">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-primary" />
                  <div>
                    <h3 className="font-semibold">{session.class.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {isValidDate ? (
                        <>
                          {sessionDate.toLocaleDateString()} at {sessionDate.toLocaleTimeString()}
                          <span className="ml-2">
                            ({formatDistanceToNow(sessionDate, { addSuffix: true })})
                          </span>
                        </>
                      ) : (
                        <span>Invalid date</span>
                      )}
                    </p>
                  </div>
                </div>
                
                <Badge 
                  variant={session.status === 'active' ? 'default' : 'secondary'}
                  className={session.status === 'active' ? 'bg-success/10 text-success' : ''}
                >
                  {session.status === 'active' ? 'Active' : 'Ended'}
                </Badge>
              </CardTitle>
              
              {isTeacher && (
                <div className="grid grid-cols-4 gap-4 mt-4">
                  <div className="text-center">
                    <div className="text-lg font-bold text-success">{stats.present}</div>
                    <div className="text-xs text-muted-foreground">Present</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-warning">{stats.pending}</div>
                    <div className="text-xs text-muted-foreground">Pending</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-muted-foreground">{stats.absent}</div>
                    <div className="text-xs text-muted-foreground">Absent</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-destructive">{stats.rejected}</div>
                    <div className="text-xs text-muted-foreground">Rejected</div>
                  </div>
                </div>
              )}
            </CardHeader>
            
            <CardContent>
              {isTeacher ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      Student Attendance ({session.attendance.length})
                    </span>
                  </div>
                  
                  {session.attendance.map((record) => (
                    <div
                      key={record.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card/50"
                    >
                      <div className="flex items-center gap-3">
                        {getStatusIcon(record.status)}
                        <div>
                          <p className="font-medium">{record.student?.name}</p>
                           {record.checkin_time && (
                             <p className="text-sm text-muted-foreground">
                               {record.status === 'pending' && !record.face_score
                                 ? 'QR scanned - awaiting face verification'
                                 : (() => {
                                     const checkinDate = new Date(record.checkin_time);
                                     return !isNaN(checkinDate.getTime()) 
                                       ? `Checked in at ${checkinDate.toLocaleTimeString()}`
                                       : 'Invalid check-in time';
                                   })()
                               }
                             </p>
                           )}
                          {record.face_score != null && (
                            <p className="text-xs text-muted-foreground">
                              Face: {record.face_score.toFixed(2)} | 
                              Liveness: {record.liveness ? 'Pass' : 'Fail'}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <Badge className={getStatusColor(record.status)}>
                          {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                        </Badge>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onEditAttendance?.(record)}
                        >
                          <Edit2 className="w-4 h-4 mr-2" />
                          Edit
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                // Student view - show only their own attendance
                <div className="text-center">
                  {session.attendance.length > 0 ? (
                    <div className="space-y-3">
                      {session.attendance.map((record) => (
                        <div key={record.id} className="p-4 rounded-lg border bg-card/50">
                          <div className="flex items-center justify-center gap-3 mb-2">
                            {getStatusIcon(record.status)}
                            <Badge className={getStatusColor(record.status)}>
                              {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                            </Badge>
                          </div>
                          
                           {record.checkin_time && (
                             <p className="text-sm text-muted-foreground">
                               {record.status === 'pending' && !record.face_score
                                 ? 'QR scanned - awaiting face verification'
                                 : (() => {
                                     const checkinDate = new Date(record.checkin_time);
                                     return !isNaN(checkinDate.getTime()) 
                                       ? `Checked in at ${checkinDate.toLocaleString()}`
                                       : 'Invalid check-in time';
                                   })()
                               }
                             </p>
                           )}
                          
                          {record.review_reason && (
                            <p className="text-sm text-muted-foreground mt-2">
                              <strong>Note:</strong> {record.review_reason}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No attendance record</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default AttendanceHistoryList;