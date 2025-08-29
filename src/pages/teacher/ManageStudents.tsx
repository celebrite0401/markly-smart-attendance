import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft, Users, Plus } from 'lucide-react';

interface EnrollmentRow {
  student_id: string;
  student_name: string;
  roll_number?: string | null;
}

const TeacherManageStudents = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || !profile || profile.role !== 'teacher') {
      navigate('/login');
      return;
    }
    (async () => {
      try {
        const { data, error } = await supabase
          .from('classes')
          .select('id, name')
          .eq('teacher_id', user!.id);
        if (error) throw error;
        setClasses(data || []);
      } catch (e) {
        toast.error('Failed to load classes');
      }
    })();
  }, [user, profile, navigate]);

  const loadEnrollments = async (classId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('enrollments')
        .select('student_id, roll_number, student:profiles(name)')
        .eq('class_id', classId);
      if (error) throw error;
      const rows: EnrollmentRow[] = (data || []).map((e:any) => ({
        student_id: e.student_id,
        student_name: e.student?.name || 'Unknown',
        roll_number: e.roll_number || null,
      }));
      setEnrollments(rows);
    } catch (e) {
      toast.error('Failed to load enrollments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedClass) loadEnrollments(selectedClass);
  }, [selectedClass]);

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
              <Users className="w-5 h-5" /> Manage Students
            </h1>
            <div />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <Card className="shadow-elegant border-0 max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle>Select Class</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2"
              >
                <option value="">Choose a class</option>
                {classes.map((c:any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              {selectedClass && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-semibold">Enrolled Students</h2>
                    <Button variant="outline" size="sm" disabled>
                      <Plus className="w-4 h-4 mr-2" />
                      Enroll (coming soon)
                    </Button>
                  </div>
                  <div className="w-full overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Roll No.</TableHead>
                          <TableHead>Student</TableHead>
                          <TableHead>Student ID</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loading ? (
                          <TableRow><TableCell colSpan={3}>Loading...</TableCell></TableRow>
                        ) : enrollments.length === 0 ? (
                          <TableRow><TableCell colSpan={3}>No students enrolled.</TableCell></TableRow>
                        ) : (
                          enrollments.map((e) => (
                            <TableRow key={e.student_id}>
                              <TableCell>{e.roll_number || '—'}</TableCell>
                              <TableCell className="font-medium">{e.student_name}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{e.student_id}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TeacherManageStudents;
