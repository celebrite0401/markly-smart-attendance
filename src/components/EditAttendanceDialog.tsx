import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, Clock, X, User } from 'lucide-react';
import { toast } from 'sonner';
import { updateAttendanceRecord } from '@/lib/api';

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

interface EditAttendanceDialogProps {
  attendance: AttendanceRecord | null;
  onClose: () => void;
  onUpdate: () => void;
}

const EditAttendanceDialog = ({ attendance, onClose, onUpdate }: EditAttendanceDialogProps) => {
  const [status, setStatus] = useState<'present' | 'pending' | 'absent' | 'rejected'>(
    attendance?.status || 'absent'
  );
  const [reason, setReason] = useState(attendance?.review_reason || '');
  const [isUpdating, setIsUpdating] = useState(false);

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

  const handleUpdate = async () => {
    if (!attendance) return;

    setIsUpdating(true);
    try {
      await updateAttendanceRecord(attendance.id, status, reason.trim() || undefined);
      
      toast.success('Attendance updated successfully');
      onUpdate();
      onClose();
    } catch (error: any) {
      console.error('Error updating attendance:', error);
      toast.error(error.message || 'Failed to update attendance');
    } finally {
      setIsUpdating(false);
    }
  };

  if (!attendance) return null;

  return (
    <Dialog open={!!attendance} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Attendance</DialogTitle>
          <DialogDescription>
            Update attendance record for {attendance.student?.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-center">
            <div className="w-24 h-24 mx-auto bg-muted rounded-lg flex items-center justify-center mb-4">
              {attendance.photo_url ? (
                <img 
                  src={attendance.photo_url} 
                  alt="Student photo"
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : (
                <User className="w-12 h-12 text-muted-foreground" />
              )}
            </div>
            
            <div className="space-y-2">
              <p className="font-medium">{attendance.student?.name}</p>
              <p className="text-sm text-muted-foreground">{attendance.student?.email}</p>
              {attendance.checkin_time && (
                <p className="text-sm text-muted-foreground">
                  Check-in: {new Date(attendance.checkin_time).toLocaleString()}
                </p>
              )}
              {attendance.face_score != null && (
                <p className="text-sm">
                  Face Score: <span className="font-medium">{attendance.face_score.toFixed(2)}</span>
                  {attendance.liveness !== undefined && (
                    <span className="ml-2">
                      | Liveness: <span className={attendance.liveness ? 'text-success' : 'text-destructive'}>
                        {attendance.liveness ? 'Pass' : 'Fail'}
                      </span>
                    </span>
                  )}
                </p>
              )}
              
              <div className="flex items-center justify-center gap-2">
                <span className="text-sm">Current:</span>
                <Badge className={getStatusColor(attendance.status)}>
                  {getStatusIcon(attendance.status)}
                  <span className="ml-1">{attendance.status}</span>
                </Badge>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Update Status</Label>
            <Select value={status} onValueChange={(value: any) => setStatus(value)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent 
                position="popper" 
                className="z-[100] max-h-[300px] overflow-y-auto bg-background border shadow-lg"
                sideOffset={4}
              >
                <SelectItem value="present" className="hover:bg-muted cursor-pointer">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-success" />
                    Present
                  </div>
                </SelectItem>
                <SelectItem value="pending" className="hover:bg-muted cursor-pointer">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-warning" />
                    Pending Review
                  </div>
                </SelectItem>
                <SelectItem value="absent" className="hover:bg-muted cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    Absent
                  </div>
                </SelectItem>
                <SelectItem value="rejected" className="hover:bg-muted cursor-pointer">
                  <div className="flex items-center gap-2">
                    <X className="w-4 h-4 text-destructive" />
                    Rejected
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Review Reason (Optional)</Label>
            <Textarea
              id="reason"
              placeholder="Enter reason for this attendance decision..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="min-h-[60px] resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isUpdating}>
            Cancel
          </Button>
          <Button onClick={handleUpdate} disabled={isUpdating}>
            {isUpdating ? 'Updating...' : 'Update Attendance'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditAttendanceDialog;