import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CheckCircle, AlertCircle, Clock, X, Eye, Check, User } from 'lucide-react';
import { toast } from 'sonner';
import { updateAttendanceRecord } from '@/lib/api';

interface Student {
  id: string;
  name: string;
  status: 'present' | 'pending' | 'absent' | 'rejected';
  checkInTime?: Date;
  faceScore?: number;
  photoUrl?: string;
  liveness?: boolean;
}

interface AttendanceListProps {
  students: Student[];
}

const AttendanceList = ({ students }: AttendanceListProps) => {
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [reviewReason, setReviewReason] = useState('');
  const [isReviewing, setIsReviewing] = useState(false);

  const getStatusIcon = (status: Student['status']) => {
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

  const getStatusColor = (status: Student['status']) => {
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

  const handleReview = (student: Student) => {
    setSelectedStudent(student);
    setReviewReason('');
  };

  const approveStudent = async () => {
    if (!selectedStudent) return;
    
    setIsReviewing(true);
    
    try {
        await updateAttendanceRecord(selectedStudent.id, 'present', 'Approved by teacher');
      toast.success(`${selectedStudent.name} approved for attendance`);
      setSelectedStudent(null);
      setIsReviewing(false);
    } catch (error) {
      console.error('Error approving student:', error);
      toast.error('Failed to approve student');
      setIsReviewing(false);
    }
  };

  const rejectStudent = async () => {
    if (!selectedStudent || !reviewReason.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }
    
    setIsReviewing(true);
    
    try {
        await updateAttendanceRecord(selectedStudent.id, 'rejected', reviewReason.trim());
      toast.error(`${selectedStudent.name} attendance rejected`);
      setSelectedStudent(null);
      setIsReviewing(false);
      setReviewReason('');
    } catch (error) {
      console.error('Error rejecting student:', error);
      toast.error('Failed to reject student');
      setIsReviewing(false);
    }
  };

  const markManual = async (present: boolean) => {
    if (!selectedStudent || !reviewReason.trim()) {
      toast.error('Please provide a reason for manual override');
      return;
    }
    
    setIsReviewing(true);
    
    try {
        await updateAttendanceRecord(selectedStudent.id, present ? 'present' : 'absent', `Manual override: ${reviewReason.trim()}`);
      toast.success(
        `${selectedStudent.name} manually marked as ${present ? 'present' : 'absent'}`
      );
      setSelectedStudent(null);
      setIsReviewing(false);
      setReviewReason('');
    } catch (error) {
      console.error('Error with manual override:', error);
      toast.error('Failed to update attendance');
      setIsReviewing(false);
    }
  };

  return (
    <div>
      <Card className="shadow-elegant border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Student Attendance ({students.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {students.map((student) => (
              <div
                key={student.id}
                className="flex items-center justify-between p-4 rounded-lg border bg-card/50 hover:bg-card/80 transition-smooth"
              >
                <div className="flex items-center gap-4">
                  {getStatusIcon(student.status)}
                  <div>
                    <h4 className="font-medium">{student.name}</h4>
                    {student.checkInTime && (
                      <p className="text-sm text-muted-foreground">
                        {student.status === 'pending' && !student.faceScore
                          ? 'QR scanned - awaiting face verification'
                          : `Checked in at ${student.checkInTime.toLocaleTimeString()}`
                        }
                      </p>
                    )}
                    {student.faceScore && (
                      <p className="text-xs text-muted-foreground">
                        Face score: {student.faceScore.toFixed(2)} | Liveness: {student.liveness ? 'Pass' : 'Fail'}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Badge className={getStatusColor(student.status)}>
                    {student.status.charAt(0).toUpperCase() + student.status.slice(1)}
                  </Badge>
                  
                  {(student.status === 'pending' || student.status === 'rejected') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReview(student)}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Review
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={!!selectedStudent} onOpenChange={() => setSelectedStudent(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Review Attendance</DialogTitle>
            <DialogDescription>
              Review {selectedStudent?.name}&apos;s attendance submission
            </DialogDescription>
          </DialogHeader>

          {selectedStudent && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                  {selectedStudent.photoUrl ? (
                    <img 
                      src={selectedStudent.photoUrl} 
                      alt="Face crop"
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <User className="w-10 h-10 text-muted-foreground" />
                  )}
                </div>
                
                <div className="flex-1 space-y-2">
                  <h3 className="font-semibold text-lg">{selectedStudent.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    Check-in: {selectedStudent.checkInTime?.toLocaleTimeString()}
                  </p>
                  {selectedStudent.faceScore && (
                    <p className="text-sm">
                      Face Score: <span className="font-medium">{selectedStudent.faceScore.toFixed(2)}</span>
                    </p>
                  )}
                  <Badge className={getStatusColor(selectedStudent.status)}>
                    {selectedStudent.status.charAt(0).toUpperCase() + selectedStudent.status.slice(1)}
                  </Badge>
                </div>
              </div>

              <div className="space-y-3">
                <Label htmlFor="review-reason" className="text-sm font-medium">
                  Reason (required for rejection/manual)
                </Label>
                <Textarea
                  id="review-reason"
                  placeholder="Enter reason for your decision..."
                  value={reviewReason}
                  onChange={(e) => setReviewReason(e.target.value)}
                  className="min-h-[80px] w-full resize-none"
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex-col gap-3 sm:flex-col">
            <div className="flex gap-2 w-full">
              <Button
                variant="default"
                onClick={approveStudent}
                disabled={isReviewing}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <Check className="w-4 h-4 mr-2" />
                Approve
              </Button>
              
              <Button
                variant="destructive"
                onClick={rejectStudent}
                disabled={isReviewing || !reviewReason.trim()}
                className="flex-1"
              >
                <X className="w-4 h-4 mr-2" />
                Reject
              </Button>
            </div>
            
            <div className="flex gap-2 w-full">
              <Button
                variant="outline"
                onClick={() => markManual(true)}
                disabled={isReviewing || !reviewReason.trim()}
                className="flex-1"
              >
                Manual Present
              </Button>
              
              <Button
                variant="outline"
                onClick={() => markManual(false)}
                disabled={isReviewing || !reviewReason.trim()}
                className="flex-1"
              >
                Manual Absent
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AttendanceList;