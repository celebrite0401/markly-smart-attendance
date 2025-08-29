import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role key for admin operations
    const supabaseAdmin = createClient(
      'https://hvtfbmhhpypzzevsladf.supabase.co',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    console.log('Checking for ended sessions...');

    const now = new Date().toISOString();
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    // First, update any sessions that should be marked as 'ended' (end_time has passed)
    const { error: updateError } = await supabaseAdmin
      .from('sessions')
      .update({ status: 'ended' })
      .lte('end_time', now)
      .eq('status', 'active');

    if (updateError) {
      console.error('Error updating session statuses:', updateError);
    } else {
      console.log('Updated expired active sessions to ended status');
    }

    // Now find sessions that ended in the last 30 minutes and need notifications (not already sent)
    const { data: endedSessions, error: sessionsError } = await supabaseAdmin
      .from('sessions')
      .select(`
        id,
        class_id,
        end_time,
        classes (
          id,
          name,
          teacher_id,
          profiles!classes_teacher_id_fkey (
            name,
            email
          )
        )
      `)
      .lte('end_time', now)
      .gte('end_time', thirtyMinutesAgo)
      .eq('status', 'ended')
      .eq('notifications_sent', false);

    if (sessionsError) {
      throw sessionsError;
    }

    console.log(`Found ${endedSessions?.length || 0} recently ended sessions`);

    if (!endedSessions || endedSessions.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No recently ended sessions found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let totalNotificationsSent = 0;

    // Process each ended session
    for (const session of endedSessions) {
      console.log(`Processing session ${session.id} for class ${session.classes?.name}`);

      // Get all students enrolled in this class
      const { data: enrolledStudents, error: enrollmentsError } = await supabaseAdmin
        .from('enrollments')
        .select(`
          student_id,
          roll_number,
          profiles!enrollments_student_id_fkey (
            id,
            name,
            email
          )
        `)
        .eq('class_id', session.class_id);

      if (enrollmentsError) {
        console.error('Error fetching enrollments:', enrollmentsError);
        continue;
      }

      // Get students who attended this session
      const { data: presentStudents, error: attendanceError } = await supabaseAdmin
        .from('attendance')
        .select('student_id')
        .eq('session_id', session.id)
        .eq('status', 'present');

      if (attendanceError) {
        console.error('Error fetching attendance:', attendanceError);
        continue;
      }

      const presentStudentIds = presentStudents?.map(a => a.student_id) || [];
      
      // Find absentees (enrolled students who didn't attend)
      const absentees = enrolledStudents?.filter(
        enrollment => !presentStudentIds.includes(enrollment.student_id)
      ) || [];

      console.log(`Found ${absentees.length} absentees for session ${session.id}`);

      // Send notification emails to absentees
      for (const absentee of absentees) {
        try {
          const student = absentee.profiles;
          if (!student?.email) {
            console.warn(`No email found for student ${student?.name || 'unknown'}`);
            continue;
          }

          const endTime = new Date(session.end_time).toLocaleString();
          const className = session.classes?.name || 'Unknown Class';
          const teacherName = session.classes?.profiles?.name || 'Your teacher';

          await resend.emails.send({
            from: 'Attendance System <onboarding@resend.dev>',
            to: [student.email],
            subject: `Absence Notice - ${className}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 10px 10px 0 0; color: white;">
                  <h1 style="margin: 0; font-size: 24px;">Attendance Notice</h1>
                </div>
                
                <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;">
                  <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
                    Dear <strong>${student.name}</strong>,
                  </p>
                  
                  <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
                    You were marked absent for the following class:
                  </p>
                  
                  <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #dc3545; margin: 20px 0;">
                    <p style="margin: 5px 0; color: #333;"><strong>Class:</strong> ${className}</p>
                    <p style="margin: 5px 0; color: #333;"><strong>Teacher:</strong> ${teacherName}</p>
                    <p style="margin: 5px 0; color: #333;"><strong>Class Ended:</strong> ${endTime}</p>
                    ${absentee.roll_number ? `<p style="margin: 5px 0; color: #333;"><strong>Roll Number:</strong> ${absentee.roll_number}</p>` : ''}
                  </div>
                  
                  <p style="font-size: 14px; color: #666; margin-top: 30px;">
                    If you believe this is an error, please contact your teacher immediately.
                  </p>
                  
                  <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e9ecef; text-align: center; color: #666; font-size: 12px;">
                    This is an automated message from the Attendance Management System
                  </div>
                </div>
              </div>
            `,
          });

          totalNotificationsSent++;
          console.log(`Sent absence notification to ${student.name} (${student.email})`);
        } catch (emailError) {
          console.error(`Failed to send email to ${absentee.profiles?.email}:`, emailError);
        }
      }

      // Mark this session as notifications_sent = true to avoid duplicates
      const { error: markError } = await supabaseAdmin
        .from('sessions')
        .update({ notifications_sent: true })
        .eq('id', session.id);

      if (markError) {
        console.error(`Failed to mark notifications_sent for session ${session.id}:`, markError);
      } else {
        console.log(`Marked notifications_sent for session ${session.id}`);
      }
    }

    console.log(`Total notifications sent: ${totalNotificationsSent}`);

    return new Response(
      JSON.stringify({ 
        message: 'Absence notifications processed successfully',
        sessionsProcessed: endedSessions.length,
        notificationsSent: totalNotificationsSent
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});