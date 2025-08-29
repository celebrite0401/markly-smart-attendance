import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { getClassRegisterDetailed, getTeacherClasses, updateAttendanceRecord } from '@/lib/api';
import { ArrowLeft, Download, Users, Edit } from 'lucide-react';
import { toast } from 'sonner';

interface DetailedRegisterEntry {
  student_id: string;
  student_name: string;
  roll_number: string;
  sessions: {
    date: string;
    session_id: string;
    status: 'present' | 'absent' | 'pending' | 'rejected';
  }[];
  total_present: number;
  total_sessions: number;
  percentage: number;
}

const ClassRegister = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { classId } = useParams<{ classId: string }>();

  const [entries, setEntries] = useState<DetailedRegisterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [className, setClassName] = useState<string>('Class Register');
  const [editingCell, setEditingCell] = useState<{studentId: string, sessionId: string} | null>(null);

  useEffect(() => {
    if (!user || !profile || profile.role !== 'teacher') {
      navigate('/login');
      return;
    }
  }, [user, profile, navigate]);

  useEffect(() => {
    const load = async () => {
      if (!user || !classId) return;
      try {
        setLoading(true);
        // Get class name for header
        const classes = await getTeacherClasses(user.id);
        const cls = classes.find((c: any) => c.id === classId);
        setClassName(cls?.name || 'Class Register');

        const data = await getClassRegisterDetailed(classId);
        setEntries(data);
      } catch (e) {
        console.error('Failed to load register:', e);
        toast.error('Failed to load class register');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, classId]);

  const exportCSV = () => {
    if (entries.length === 0) return;
    
    const dates = [...new Set(entries.flatMap(e => e.sessions.map(s => s.date)))].sort();
    const header = ['Name', 'Roll Number', ...dates, 'Total Present', 'Percentage'];
    
    const rows = entries.map(entry => [
      entry.student_name,
      entry.roll_number || '',
      ...dates.map(date => {
        const session = entry.sessions.find(s => s.date === date);
        return session ? (session.status === 'present' ? 'P' : 'A') : '';
      }),
      entry.total_present,
      `${entry.percentage}%`
    ]);
    
    const csv = [header.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${className.replace(/\s+/g, '-')}-register.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Register exported');
  };

  const handleStatusChange = async (studentId: string, sessionId: string, newStatus: string) => {
    try {
      await updateAttendanceRecord(
        entries.find(e => e.student_id === studentId)?.sessions.find(s => s.session_id === sessionId)?.session_id || '',
        newStatus as 'present' | 'absent' | 'pending' | 'rejected',
        'Updated from register'
      );
      
      // Refresh data
      const data = await getClassRegisterDetailed(classId!);
      setEntries(data);
      setEditingCell(null);
      toast.success('Attendance updated');
    } catch (error) {
      console.error('Error updating attendance:', error);
      toast.error('Failed to update attendance');
    }
  };

  const totalPresent = useMemo(() => entries.reduce((sum, e) => sum + e.total_present, 0), [entries]);
  const averagePercentage = useMemo(() => {
    if (entries.length === 0) return 0;
    return entries.reduce((sum, e) => sum + e.percentage, 0) / entries.length;
  }, [entries]);

  // Get all unique session dates
  const sessionDates = useMemo(() => {
    const dates = [...new Set(entries.flatMap(e => e.sessions.map(s => s.date)))];
    return dates.sort();
  }, [entries]);

  return (
    <div className="min-h-screen gradient-subtle">
      <div className="bg-card/80 backdrop-blur-sm border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" onClick={() => navigate('/teacher/dashboard')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
              <div>
                <h1 className="text-xl font-semibold">{className}</h1>
                <p className="text-sm text-muted-foreground">Attendance Register</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={exportCSV} disabled={entries.length === 0}>
                <Download className="w-4 h-4 mr-2" /> Export CSV
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <Card className="shadow-elegant border-0">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Class Register
              </CardTitle>
              <div className="text-sm text-muted-foreground">
                Total Students: {entries.length} | Average Attendance: {averagePercentage.toFixed(1)}%
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-muted-foreground">Loading register...</div>
            ) : entries.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">No enrollments found.</div>
            ) : (
              <div className="w-full overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-background z-10 min-w-[150px]">Name</TableHead>
                      <TableHead className="sticky left-[150px] bg-background z-10 min-w-[100px]">Roll</TableHead>
                      {sessionDates.map(date => (
                        <TableHead key={date} className="text-center min-w-[80px]">
                          {new Date(date).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </TableHead>
                      ))}
                      <TableHead className="text-center min-w-[80px]">Present</TableHead>
                      <TableHead className="text-center min-w-[80px]">%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry) => (
                      <TableRow key={entry.student_id}>
                        <TableCell className="sticky left-0 bg-background z-10 font-medium min-w-[150px]">
                          {entry.student_name}
                        </TableCell>
                        <TableCell className="sticky left-[150px] bg-background z-10 text-center min-w-[100px]">
                          {entry.roll_number || '—'}
                        </TableCell>
                        {sessionDates.map(date => {
                          const session = entry.sessions.find(s => s.date === date);
                          const isEditing = editingCell?.studentId === entry.student_id && 
                                          session && editingCell?.sessionId === session.session_id;
                          
                          return (
                            <TableCell key={`${entry.student_id}-${date}`} className="text-center p-2">
                              {session ? (
                                isEditing ? (
                                  <Select
                                    value={session.status}
                                    onValueChange={(value) => handleStatusChange(entry.student_id, session.session_id, value)}
                                  >
                                    <SelectTrigger className="h-8 w-16 mx-auto">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent position="popper" className="z-[100] max-h-[300px] overflow-y-auto bg-background border shadow-lg">
                                      <SelectItem value="present">P</SelectItem>
                                      <SelectItem value="absent">A</SelectItem>
                                      <SelectItem value="pending">?</SelectItem>
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <div 
                                    className="cursor-pointer hover:bg-muted rounded px-2 py-1 flex items-center justify-center gap-1"
                                    onClick={() => setEditingCell({studentId: entry.student_id, sessionId: session.session_id})}
                                  >
                                    <span className={`font-bold ${
                                      session.status === 'present' ? 'text-success' : 
                                      session.status === 'pending' ? 'text-warning' : 
                                      'text-muted-foreground'
                                    }`}>
                                      {session.status === 'present' ? 'P' : 
                                       session.status === 'pending' ? '?' : 'A'}
                                    </span>
                                    <Edit className="w-3 h-3 opacity-0 group-hover:opacity-100" />
                                  </div>
                                )
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-center font-bold text-success">
                          {entry.total_present}
                        </TableCell>
                        <TableCell className="text-center font-bold">
                          {entry.percentage.toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="text-sm text-muted-foreground mt-4 p-4 bg-muted/30 rounded">
                  <div className="flex justify-between items-center">
                    <span>Total presents across all students: {totalPresent}</span>
                    <span>Class average: {averagePercentage.toFixed(1)}%</span>
                  </div>
                  <div className="mt-2 text-xs">
                    P = Present, A = Absent, ? = Pending Review | Click on any cell to edit attendance
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ClassRegister;