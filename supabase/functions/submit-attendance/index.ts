import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization header required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    const { sessionId, token, photoBlob, liveness } = await req.json();

    console.log('Submit attendance request:', { 
      sessionId, 
      token: token?.slice(0, 8) + '...', 
      hasPhoto: !!photoBlob,
      liveness
    });

    // Verify the session and token
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id, qr_secret, status, start_time, end_time, class_id')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      console.error('Session not found:', sessionError);
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify session is active
    if (session.status !== 'active') {
      return new Response(JSON.stringify({ error: 'Session is not active' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate and verify HMAC token (simplified for now - in production use proper HMAC)
    const currentTime = new Date();
    const sessionTime = new Date(session.start_time);
    const endTime = new Date(session.end_time);
    
    if (currentTime < sessionTime || currentTime > endTime) {
      return new Response(JSON.stringify({ error: 'Session not in valid time window' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Decode and validate token
    let tokenData;
    try {
      tokenData = JSON.parse(atob(token));
    } catch (error) {
      console.error('Invalid token format:', error);
      return new Response(JSON.stringify({ error: 'Invalid token format' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate token matches session
    if (!tokenData || tokenData.sessionId !== sessionId || tokenData.secret !== session.qr_secret) {
      console.error('Token validation failed:', { 
        tokenSessionId: tokenData?.sessionId, 
        expectedSessionId: sessionId,
        secretMatch: tokenData?.secret === session.qr_secret
      });
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user is enrolled in the class
    const { data: enrollment, error: enrollmentError } = await supabase
      .from('enrollments')
      .select('id')
      .eq('student_id', user.id)
      .eq('class_id', session.class_id)
      .single();

    if (enrollmentError || !enrollment) {
      return new Response(JSON.stringify({ error: 'Not enrolled in this class' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Upload photo to secure storage
    let photoUrl = null;
    if (photoBlob) {
      const fileName = `${user.id}/${sessionId}/${Date.now()}.jpg`;
      
      // Convert base64 to blob
      const photoData = Uint8Array.from(atob(photoBlob), c => c.charCodeAt(0));
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('attendance-photos')
        .upload(fileName, photoData, {
          contentType: 'image/jpeg',
          upsert: false
        });

      if (uploadError) {
        console.error('Photo upload error:', uploadError);
        return new Response(JSON.stringify({ error: 'Failed to upload photo' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      photoUrl = `attendance-photos/${fileName}`;
    }

    // Simplified face verification - no face descriptor needed
    const faceScore = null; // Not using face score anymore, just liveness
    
    console.log('Face verification data:', { 
      liveness,
      usingSimplifiedVerification: true
    });

    // Simplified rule: mark present if liveness is confirmed
    let attendanceStatus = liveness === true ? 'present' : 'pending';
    console.log('Attendance status (simplified):', { liveness, attendanceStatus });

    // Use student's JWT for attendance updates (not service role)
    const studentSupabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    // Create or update attendance record using student's auth
    const { data: existingAttendance } = await studentSupabase
      .from('attendance')
      .select('id')
      .eq('student_id', user.id)
      .eq('session_id', sessionId)
      .single();

    let attendanceData;
    if (existingAttendance) {
      // Update existing record
      const { data, error } = await studentSupabase
        .from('attendance')
        .update({
          status: attendanceStatus,
          checkin_time: new Date().toISOString(),
          photo_url: photoUrl,
          face_score: faceScore,
          liveness,
        })
        .eq('id', existingAttendance.id)
        .select()
        .single();

      if (error) {
        console.error('Failed to update attendance:', error);
        return new Response(JSON.stringify({ error: 'Failed to update attendance' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      attendanceData = data;
    } else {
      // Create new record
      const { data, error } = await studentSupabase
        .from('attendance')
        .insert({
          student_id: user.id,
          session_id: sessionId,
          status: attendanceStatus,
          checkin_time: new Date().toISOString(),
          photo_url: photoUrl,
          face_score: faceScore,
          liveness,
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to create attendance:', error);
        return new Response(JSON.stringify({ error: 'Failed to create attendance' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      attendanceData = data;
    }

    console.log('Attendance submitted successfully:', attendanceData.id);

    const message = attendanceStatus === 'present' 
      ? 'Attendance marked successfully!'
      : attendanceStatus === 'pending'
      ? 'Attendance submitted for review'
      : 'Face verification failed';

    return new Response(JSON.stringify({ 
      success: true, 
      attendance: attendanceData,
      status: attendanceStatus,
      message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in submit-attendance function:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});