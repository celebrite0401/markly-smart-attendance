import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Class {
  id: string;
  name: string;
  description?: string;
  teacher_id: string;
  schedule?: {
    day: string;
    time: string;
    duration: number;
  }[] | any; // schedule is jsonb in DB; can vary
  created_at: string;
  updated_at: string;
  teacher?: {
    name: string;
    email: string;
  };
  enrollments?: { count: number }[]; // via select join
}

export interface Session {
  id: string;
  class_id: string;
  teacher_id: string;
  start_time: string;
  end_time: string;
  extended: boolean;
  qr_secret: string;
  status: 'active' | 'ended';
  created_at: string;
  class?: Class;
}

export interface Attendance {
  id: string;
  session_id: string;
  student_id: string;
  status: 'present' | 'pending' | 'absent' | 'rejected';
  checkin_time?: string;
  face_score?: number;
  liveness?: boolean;
  photo_url?: string;
  proof_hash?: string;
  prev_hash?: string;
  reviewer_id?: string;
  review_reason?: string;
  created_at: string;
  student?: {
    name: string;
    email: string;
  };
}

// Classes API
export const getTeacherClasses = async (teacherId: string) => {
  const { data, error } = await supabase
    .from('classes')
    .select(`
      *,
      enrollments(count)
    `)
    .eq('teacher_id', teacherId);
  
  if (error) throw error;
  return data || [];
};

export const getTodayTeacherClasses = async (teacherId: string) => {
  const allClasses = await getTeacherClasses(teacherId);
  
  // Filter classes based on current day
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  
  const todayClasses = allClasses.filter(classItem => {
    if (!classItem.schedule || !Array.isArray(classItem.schedule)) {
      return false; // No schedule means not active today
    }
    
    // Check if any schedule entry matches today
    return classItem.schedule.some((scheduleItem: any) => {
      return scheduleItem.day?.toLowerCase() === today;
    });
  });
  
  return todayClasses;
};

export const getStudentClasses = async (studentId: string) => {
  const { data, error } = await supabase
    .from('enrollments')
    .select(`
      *,
      class:classes(
        *,
        teacher:profiles!classes_teacher_id_fkey(name, email)
      )
    `)
    .eq('student_id', studentId);
  
  if (error) throw error;
  return data;
};

// Sessions API
export const createSession = async (classId: string, teacherId: string): Promise<Session> => {
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

  // Check if there's already a session for this class today
  const { data: existingSession } = await supabase
    .from('sessions')
    .select()
    .eq('class_id', classId)
    .eq('teacher_id', teacherId)
    .gte('start_time', todayStart)
    .lt('start_time', todayEnd)
    .maybeSingle();

  if (existingSession) {
    // Reactivate existing session - don't create new attendance records
    const { data, error } = await supabase
      .from('sessions')
      .update({
        status: 'active',
        end_time: new Date(Date.now() + 90 * 1000).toISOString(), // 90 seconds
        qr_secret: Math.random().toString(36).substring(2, 15) // Generate new QR secret for security
      })
      .eq('id', existingSession.id)
      .select()
      .single();

    if (error) {
      console.error('Error reactivating session:', error);
      throw new Error(`Failed to reactivate session: ${error.message}`);
    }

    console.log('Reactivated existing daily session:', data.id);
    return data as Session;
  }

  // Create new session
  const startTime = new Date();
  const endTime = new Date(startTime.getTime() + 90 * 1000); // 90 seconds
  const qrSecret = Math.random().toString(36).substring(2, 15);

  const { data, error } = await supabase
    .from('sessions')
    .insert({
      class_id: classId,
      teacher_id: teacherId,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      qr_secret: qrSecret,
      status: 'active'
    })
    .select()
    .single();

  if (error) throw error;
  
  // Create attendance records for all enrolled students
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('student_id')
    .eq('class_id', classId);

  if (enrollments) {
    const attendanceRecords = enrollments.map(enrollment => ({
      session_id: data.id,
      student_id: enrollment.student_id,
      status: 'absent' as const
    }));

    await supabase
      .from('attendance')
      .insert(attendanceRecords);
  }

  console.log('Created new daily session:', data.id);
  return data as Session;
};

export const extendSession = async (sessionId: string) => {
  const { data: session } = await supabase
    .from('sessions')
    .select('end_time, extended')
    .eq('id', sessionId)
    .single();

  if (!session || session.extended) {
    throw new Error('Session cannot be extended');
  }

  const newEndTime = new Date(new Date(session.end_time).getTime() + 30 * 1000);

  const { data, error } = await supabase
    .from('sessions')
    .update({
      end_time: newEndTime.toISOString(),
      extended: true
    })
    .eq('id', sessionId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const endSession = async (sessionId: string) => {
  const { data, error } = await supabase
    .from('sessions')
    .update({ 
      status: 'ended',
      end_time: new Date().toISOString()
    })
    .eq('id', sessionId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

// QR Token Generation
export const generateQRToken = (sessionId: string, qrSecret: string) => {
  const timestamp = Math.floor(Date.now() / 1000);
  const slotTime = Math.floor(timestamp / 10); // 10-second slots
  
  const tokenData = {
    sessionId,
    slotTime,
    secret: qrSecret
  };
  
  return btoa(JSON.stringify(tokenData));
};

// Attendance API
export const acknowledgeScan = async (token: string, studentId: string) => {
  try {
    console.log('=== ACKNOWLEDGE SCAN START ===');
    console.log('acknowledgeScan called with:', { token: token.substring(0, 50) + '...', studentId });
    
    // Decode and validate token
    let tokenData;
    try {
      tokenData = JSON.parse(atob(token));
      console.log('Decoded token data:', tokenData);
    } catch (e) {
      console.error('Failed to decode token:', e);
      throw new Error('Invalid token format');
    }
    
    const { sessionId } = tokenData;
    
    if (!sessionId) {
      throw new Error('Token missing session ID');
    }
    
    console.log('Looking for session:', sessionId);
    
    // Check if session is still active
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('status', 'active')
      .maybeSingle();

    console.log('Session query result:', { session, sessionError });

    if (sessionError || !session) {
      throw new Error('Session not found or expired');
    }

    // Validate QR secret (no backdoors allowed)
    if (tokenData.secret !== session.qr_secret) {
      throw new Error('Invalid QR token');
    }

    const now = new Date();
    const sessionEnd = new Date(session.end_time);
    
    console.log('Time validation:', { now: now.toISOString(), sessionEnd: sessionEnd.toISOString() });
    
    if (now > sessionEnd) {
      throw new Error('Session has ended');
    }

    console.log('Updating attendance to pending status for face verification...');
    // Check if student is already present - prevent double attendance
    const { data: currentAttendance, error: attendanceCheckError } = await supabase
      .from('attendance')
      .select('status')
      .eq('session_id', sessionId)
      .eq('student_id', studentId)
      .maybeSingle();

    if (attendanceCheckError) {
      console.error('Error checking current attendance:', attendanceCheckError);
      throw new Error('Failed to check attendance status');
    }

    if (!currentAttendance) {
      // Create attendance record if it doesn't exist (for newly enrolled students or reactivated sessions)
      console.log('No attendance record found, creating one...');
      const { data: newAttendance, error: createError } = await supabase
        .from('attendance')
        .insert({
          session_id: sessionId,
          student_id: studentId,
          status: 'pending',
          checkin_time: now.toISOString()
        })
        .select()
        .single();

      if (createError) {
        console.error('Failed to create attendance record:', createError);
        throw new Error('Failed to create attendance record');
      }

      console.log('Created new attendance record:', newAttendance);
      console.log('=== ACKNOWLEDGE SCAN SUCCESS ===');
      return newAttendance;
    }

    if (currentAttendance.status === 'present') {
      throw new Error('You have already been marked present for this session');
    }

    // Update attendance to 'pending' for face verification
    const { data, error } = await supabase
      .from('attendance')
      .update({
        status: 'pending',
        checkin_time: now.toISOString()
      })
      .eq('session_id', sessionId)
      .eq('student_id', studentId)
      .select()
      .maybeSingle();

    console.log('Attendance update result:', { data, error });

    if (error) {
      console.error('Database error during acknowledgeScan:', error);
      throw error;
    }

    if (!data) {
      throw new Error('No attendance record found to update');
    }

    console.log('=== ACKNOWLEDGE SCAN SUCCESS ===');
    return data;

  } catch (error: any) {
    console.error('=== ACKNOWLEDGE SCAN ERROR ===');
    console.error('Scan acknowledgment error:', error);
    throw error;
  }
};

export const getSessionAttendance = async (sessionId: string) => {
  const { data, error } = await supabase
    .from('attendance')
    .select(`
      *,
      student:profiles!attendance_student_id_fkey(name, email)
    `)
    .eq('session_id', sessionId);

  if (error) throw error;
  return data;
};

export const submitAttendance = async (
  token: string,
  liveness: boolean,
  photoBase64?: string
) => {
  console.log('=== API SUBMIT ATTENDANCE START ===');
  console.log('submitAttendance called with:', {
    hasToken: !!token,
    liveness,
    hasPhoto: !!photoBase64
  });

  const parsed = JSON.parse(atob(token));
  const sessionId = parsed?.sessionId;

  // Use secure edge function for attendance submission
  const { data, error } = await supabase.functions.invoke('submit-attendance', {
    body: {
      sessionId,
      token,
      photoBlob: photoBase64 ?? null,
      liveness
    }
  });

  console.log('Edge function response:', { data, error });

  if (error) {
    console.error('=== API SUBMIT ATTENDANCE ERROR ===');
    console.error('Edge function error:', error);
    throw error;
  }
  
  console.log('=== API SUBMIT ATTENDANCE SUCCESS ===');
  console.log('Returning data:', data);
  return data;
};

// Admin API - Now uses secure edge functions
export const secureAdminOperation = async (operation: string, data: any) => {
  const { data: result, error } = await supabase.functions.invoke('secure-admin-operations', {
    body: { operation, data }
  });

  if (error) throw error;
  return result;
};

export const updateUserSecure = async (userId: string, updates: any) => {
  return secureAdminOperation('updateUser', { userId, updates });
};

export const deleteUserSecure = async (userIdToDelete: string) => {
  return secureAdminOperation('deleteUser', { userIdToDelete });
};

// Classes management
export const createClass = async (
  name: string,
  description: string,
  teacherId: string,
  schedule: any
) => {
  const { data, error } = await supabase
    .from('classes')
    .insert({
      name,
      description,
      teacher_id: teacherId,
      schedule
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateClass = async (
  classId: string,
  name: string,
  description: string,
  teacherId: string,
  schedule: any
) => {
  const { data, error } = await supabase
    .from('classes')
    .update({
      name,
      description,
      teacher_id: teacherId,
      schedule
    })
    .eq('id', classId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deleteClass = async (classId: string) => {
  const { error } = await supabase
    .from('classes')
    .delete()
    .eq('id', classId);

  if (error) throw error;
};

// Attendance management
export const updateAttendanceRecord = async (
  attendanceId: string,
  status: 'present' | 'pending' | 'absent' | 'rejected',
  reviewReason?: string
) => {
  const updateData: any = { status };
  if (reviewReason) {
    updateData.review_reason = reviewReason;
  }

  const { data, error } = await supabase
    .from('attendance')
    .update(updateData)
    .eq('id', attendanceId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const getAttendanceStats = async (studentId: string) => {
  const { data, error } = await supabase
    .from('attendance')
    .select(`
      id,
      status,
      checkin_time,
      session:sessions!inner(
        id,
        start_time,
        class:classes!inner(
          name
        )
      )
    `)
    .eq('student_id', studentId)
    .order('checkin_time', { ascending: false });

  if (error) throw error;
  return data;
};

export const getTeacherAttendanceOverview = async (teacherId: string) => {
  const { data, error } = await supabase
    .from('sessions')
    .select(`
      id,
      start_time,
      status,
      class:classes!inner(
        name
      ),
      attendance(
        id,
        status,
        student:profiles!inner(name)
      )
    `)
    .eq('teacher_id', teacherId)
    .order('start_time', { ascending: false });

  if (error) throw error;
  return data;
};

// Compatibility functions that transform data to match expected interfaces
export const getStudentAttendanceHistory = async (studentId: string) => {
  const data = await getAttendanceStats(studentId);
  return data?.map(item => ({
    id: item.id,
    status: item.status as 'present' | 'pending' | 'absent' | 'rejected',
    date: item.checkin_time || item.session.start_time,
    className: item.session.class.name,
    teacherName: 'Teacher', // TODO: Add teacher name to query
    checkin_time: item.checkin_time,
    session: item.session
  })) || [];
};

export const getStudentAttendanceStats = async (studentId: string) => {
  const data = await getAttendanceStats(studentId);
  // Transform to expected stats format
  const statsMap = new Map();
  
  data?.forEach(item => {
    const classId = item.session.class.name;
    if (!statsMap.has(classId)) {
      statsMap.set(classId, {
        classId,
        className: item.session.class.name,
        totalSessions: 0,
        presentCount: 0,
        pendingCount: 0,
        absentCount: 0,
        rejectedCount: 0,
        attendanceRate: 0,
        recentAttendance: []
      });
    }
    
    const stats = statsMap.get(classId);
    stats.totalSessions++;
    
    if (item.status === 'present') stats.presentCount++;
    else if (item.status === 'pending') stats.pendingCount++;
    else if (item.status === 'absent') stats.absentCount++;
    else if (item.status === 'rejected') stats.rejectedCount++;
    
    stats.attendanceRate = (stats.presentCount / stats.totalSessions) * 100;
  });
  
  return Array.from(statsMap.values());
};

export const getTeacherAttendanceHistory = async (teacherId: string) => {
  try {
    const { data, error } = await supabase
      .from('sessions')
      .select(`
        id,
        start_time,
        end_time,
        status,
        class:classes!sessions_class_id_fkey(
          id,
          name
        ),
        attendance(
          id,
          student_id,
          session_id,
          status,
          checkin_time,
          face_score,
          liveness,
          photo_url,
          review_reason,
          student:profiles!attendance_student_id_fkey(name, email)
        )
      `)
      .eq('teacher_id', teacherId)
      .order('start_time', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Supabase error in getTeacherAttendanceHistory:', error);
      throw error;
    }

    console.log('Raw teacher attendance history data:', data);
    return data || [];
  } catch (error) {
    console.error('Error in getTeacherAttendanceHistory:', error);
    throw error;
  }
};
export const getActiveSessionsCount = async (teacherId: string) => {
  const { data, error } = await supabase
    .from('sessions')
    .select('id')
    .eq('teacher_id', teacherId)
    .eq('status', 'active');
  if (error) throw error;
  return data?.length || 0;
};

export interface ClassRegisterEntry {
  student_id: string;
  student_name: string;
  total_present: number;
  total_sessions: number;
  present_dates: string[];
}

export interface DetailedRegisterEntry {
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

export const getClassRegister = async (classId: string): Promise<ClassRegisterEntry[]> => {
  try {
    const { data: enrollments, error: enrollmentsError } = await supabase
      .from('enrollments')
      .select(`
        student_id,
        student:profiles!enrollments_student_id_fkey(name)
      `)
      .eq('class_id', classId);

    if (enrollmentsError) throw enrollmentsError;

    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select(`
        id,
        start_time,
        attendance(student_id, status)
      `)
      .eq('class_id', classId);

    if (sessionsError) throw sessionsError;

    const result = enrollments?.map(enrollment => {
      const presentSessions = sessions?.filter(session => 
        session.attendance?.some(att => 
          att.student_id === enrollment.student_id && att.status === 'present'
        )
      ) || [];

      return {
        student_id: enrollment.student_id,
        student_name: enrollment.student?.name || 'Unknown Student',
        total_present: presentSessions.length,
        total_sessions: sessions?.length || 0,
        present_dates: presentSessions.map(s => new Date(s.start_time).toLocaleDateString())
      };
    }) || [];

    return result.sort((a, b) => a.student_name.localeCompare(b.student_name));
  } catch (error) {
    console.error('Error fetching class register:', error);
    throw error;
  }
};

export const getClassRegisterDetailed = async (classId: string): Promise<DetailedRegisterEntry[]> => {
  try {
    // Get all enrollments for this class with student details
    const { data: enrollments, error: enrollmentsError } = await supabase
      .from('enrollments')
      .select(`
        student_id,
        roll_number,
        student:profiles!enrollments_student_id_fkey(name)
      `)
      .eq('class_id', classId);

    if (enrollmentsError) throw enrollmentsError;

    // Get all sessions for this class
    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select(`
        id,
        start_time,
        attendance(student_id, status)
      `)
      .eq('class_id', classId)
      .order('start_time', { ascending: true });

    if (sessionsError) throw sessionsError;

    // Process the data to create detailed register
    const result = enrollments?.map(enrollment => {
      const sessionData = sessions?.map(session => {
        const attendance = session.attendance?.find(a => a.student_id === enrollment.student_id);
        return {
          date: new Date(session.start_time).toISOString().split('T')[0],
          session_id: session.id,
          status: (attendance?.status || 'absent') as 'present' | 'absent' | 'pending' | 'rejected'
        };
      }) || [];

      const totalPresent = sessionData.filter(s => s.status === 'present').length;
      const totalSessions = sessionData.length;
      const percentage = totalSessions > 0 ? (totalPresent / totalSessions) * 100 : 0;

      return {
        student_id: enrollment.student_id,
        student_name: enrollment.student?.name || 'Unknown Student',
        roll_number: enrollment.roll_number || '',
        sessions: sessionData,
        total_present: totalPresent,
        total_sessions: totalSessions,
        percentage: Math.round(percentage * 10) / 10
      };
    }) || [];

    return result.sort((a, b) => a.student_name.localeCompare(b.student_name));
  } catch (error) {
    console.error('Error fetching detailed class register:', error);
    throw error;
  }
};