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
    // Initialize Supabase client with service role
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

    // Verify user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || profile.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { operation, data } = await req.json();

    switch (operation) {
      case 'updateUser':
        const { userId, updates } = data;
        
        // Update auth user if email/password changed
        if (updates.email || updates.password) {
          const authUpdates: any = {};
          if (updates.email) authUpdates.email = updates.email;
          if (updates.password) authUpdates.password = updates.password;
          
          const { error: authUpdateError } = await supabase.auth.admin.updateUserById(userId, authUpdates);
          if (authUpdateError) {
            console.error('Auth update error:', authUpdateError);
            return new Response(JSON.stringify({ error: 'Failed to update user auth' }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }

        // Update profile
        const profileUpdates: any = {};
        if (updates.name) profileUpdates.name = updates.name;
        if (updates.role) profileUpdates.role = updates.role;
        if (updates.email) profileUpdates.email = updates.email;
        if (updates.section) profileUpdates.section = updates.section;
        if (updates.rollNumber) profileUpdates.roll_number = updates.rollNumber;

        const { data: updatedProfile, error: profileUpdateError } = await supabase
          .from('profiles')
          .update(profileUpdates)
          .eq('id', userId)
          .select()
          .single();

        if (profileUpdateError) {
          console.error('Profile update error:', profileUpdateError);
          return new Response(JSON.stringify({ error: 'Failed to update profile' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ success: true, profile: updatedProfile }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'deleteUser':
        const { userIdToDelete } = data;
        
        // Delete user from auth (this will cascade to profile due to foreign key)
        const { error: deleteError } = await supabase.auth.admin.deleteUser(userIdToDelete);
        if (deleteError) {
          console.error('User deletion error:', deleteError);
          return new Response(JSON.stringify({ error: 'Failed to delete user' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      default:
        return new Response(JSON.stringify({ error: 'Invalid operation' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

  } catch (error) {
    console.error('Error in secure-admin-operations function:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});