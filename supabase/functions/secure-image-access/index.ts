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

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { filePath } = await req.json();

    // Get user profile to check role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Admin can access all files
    if (profile.role === 'admin') {
      const { data: signedUrl, error: signError } = await supabase.storage
        .from('attendance-photos')
        .createSignedUrl(filePath, 3600); // 1 hour expiry

      if (signError) {
        return new Response(JSON.stringify({ error: 'Failed to generate signed URL' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ signedUrl: signedUrl.signedUrl }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // For teachers, verify they own the session associated with the attendance photo
    if (profile.role === 'teacher') {
      // Extract student_id and session_id from file path if following naming convention
      const pathParts = filePath.split('/');
      if (pathParts.length >= 2) {
        const studentId = pathParts[0];
        const sessionId = pathParts[1];

        // Verify teacher owns the session
        const { data: session, error: sessionError } = await supabase
          .from('sessions')
          .select('id')
          .eq('id', sessionId)
          .eq('teacher_id', user.id)
          .single();

        if (sessionError || !session) {
          return new Response(JSON.stringify({ error: 'Unauthorized access to this image' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Generate signed URL
        const { data: signedUrl, error: signError } = await supabase.storage
          .from('attendance-photos')
          .createSignedUrl(filePath, 3600); // 1 hour expiry

        if (signError) {
          return new Response(JSON.stringify({ error: 'Failed to generate signed URL' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ signedUrl: signedUrl.signedUrl }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // For students, only allow access to their own photos
    if (profile.role === 'student') {
      const pathParts = filePath.split('/');
      if (pathParts.length >= 1 && pathParts[0] === user.id) {
        const { data: signedUrl, error: signError } = await supabase.storage
          .from('attendance-photos')
          .createSignedUrl(filePath, 3600); // 1 hour expiry

        if (signError) {
          return new Response(JSON.stringify({ error: 'Failed to generate signed URL' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ signedUrl: signedUrl.signedUrl }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ error: 'Unauthorized access to this image' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in secure-image-access function:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});