import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft, Download, BookOpen } from 'lucide-react';
import { getTeacherClasses, getClassRegister } from '@/lib/api';

const TeacherExportData = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || !profile || profile.role !== 'teacher') {
      navigate('/login');
      return;
    }
    (async () => {
      try {
        const data = await getTeacherClasses(user!.id);
        setClasses(data);
      } catch (e) {
        toast.error('Failed to load classes');
      }
    })();
  }, [user, profile, navigate]);

  const exportRegister = async () => {
    if (!selectedClass) {
      toast.error('Please select a class');
      return;
    }
    try {
      setLoading(true);
      const entries = await getClassRegister(selectedClass);
      const clsName = classes.find(c => c.id === selectedClass)?.name || 'class';
      
      // Create properly formatted CSV with quoted strings to handle commas in names
      const header = ['Student Name', 'Total Present', 'Total Sessions', 'Attendance Percentage', 'Present Dates'];
      const csvRows = [header.join(',')];
      
      entries.forEach(e => {
        const percentage = e.total_sessions > 0 ? ((e.total_present / e.total_sessions) * 100).toFixed(1) : '0.0';
        const presentDatesFormatted = e.present_dates.join('; '); // Use semicolon instead of pipe for better CSV compatibility
        
        const row = [
          `"${e.student_name}"`, // Quote the name to handle commas
          e.total_present.toString(),
          e.total_sessions.toString(),
          `${percentage}%`,
          `"${presentDatesFormatted}"` // Quote dates to handle commas and semicolons
        ];
        csvRows.push(row.join(','));
      });
      
      const csv = csvRows.join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${clsName.replace(/[^a-zA-Z0-9]/g, '-')}-attendance-register-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Exported register CSV successfully');
    } catch (e:any) {
      console.error(e);
      toast.error('Failed to export: ' + (e.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

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
              <BookOpen className="w-5 h-5" /> Export Data
            </h1>
            <div />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <Card className="shadow-elegant border-0 max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Export Attendance Register</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground">Choose Class</label>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                >
                  <option value="">Select a class</option>
                  {classes.map((c:any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <Button onClick={exportRegister} disabled={loading}>
                <Download className="w-4 h-4 mr-2" />
                {loading ? 'Exporting...' : 'Export Register CSV'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TeacherExportData;
