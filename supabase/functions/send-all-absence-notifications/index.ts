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
    const { teacherId } = await req.json();
    
    if (!teacherId) {
      throw new Error('Teacher ID is required');
    }

    // Start background processing and return immediately
    EdgeRuntime.waitUntil(processNotifications(teacherId));
    
    return new Response(
      JSON.stringify({ started: true, message: 'Notification processing started in background' }),
      { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error starting notifications:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to start notifications', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function processNotifications(teacherId: string) {
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

    console.log('Checking for recent sessions across all classes for teacher:', teacherId);

    const now = new Date().toISOString();
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Find sessions from the last 24 hours for this teacher where end_time has passed
    const { data: recentSessions, error: sessionsError } = await supabaseAdmin
      .from('sessions')
      .select(`
        id,
        class_id,
        start_time,
        end_time,
        status,
        classes (
          id,
          name,
          teacher_id
        )
      `)
      .eq('classes.teacher_id', teacherId)
      .lte('end_time', now)
      .gte('end_time', twentyFourHoursAgo);

    if (sessionsError) {
      throw sessionsError;
    }

    console.log(`Found ${recentSessions?.length || 0} recent sessions for teacher`);

    if (!recentSessions || recentSessions.length === 0) {
      console.log('No recent sessions found in the last 24 hours');
      return;
    }

    let totalNotificationsSent = 0;
    const processedSessions = [];

    // Process each session to find absentees
    for (const session of recentSessions) {
      console.log(`Processing session ${session.id} for class ${session.classes?.name}`);
      
      try {
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

        // Get students who attended this session (present or pending review)
        const { data: presentStudents, error: attendanceError } = await supabaseAdmin
          .from('attendance')
          .select('student_id')
          .eq('session_id', session.id)
          .in('status', ['present', 'pending']);

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

            const sessionDate = new Date(session.start_time).toLocaleDateString();
            const sessionTime = new Date(session.start_time).toLocaleTimeString();
            const className = session.classes?.name || 'Unknown Class';

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
                      <p style="margin: 5px 0; color: #333;"><strong>Subject:</strong> ${className}</p>
                      <p style="margin: 5px 0; color: #333;"><strong>Date:</strong> ${sessionDate}</p>
                      <p style="margin: 5px 0; color: #333;"><strong>Time:</strong> ${sessionTime}</p>
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
            console.log(`Sent absence notification to ${student.name} (${student.email}) for ${className}`);
          } catch (emailError) {
            console.error(`Failed to send email to ${absentee.profiles?.email}:`, emailError);
          }
        }

        processedSessions.push({
          sessionId: session.id,
          className: session.classes?.name,
          absenteesCount: absentees.length
        });

      } catch (sessionError) {
        console.error(`Error processing session ${session.id}:`, sessionError);
      }
    }

    console.log(`Total notifications sent: ${totalNotificationsSent}`);

  } catch (error) {
    console.error('Background notification processing error:', error);
  }
}