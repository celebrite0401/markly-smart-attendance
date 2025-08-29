import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    // Create Supabase client with service role for admin operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('=== SCHEDULED ABSENCE NOTIFICATION CHECK ===');
    
    // First, update any sessions that have ended but are still marked as active
    const { error: updateError } = await supabase
      .from('sessions')
      .update({ status: 'ended' })
      .eq('status', 'active')
      .lt('end_time', new Date().toISOString());

    if (updateError) {
      console.error('Error updating expired sessions:', updateError);
    } else {
      console.log('Updated expired active sessions to ended status');
    }

    // Call the main absence notification function
    const { data, error } = await supabase.functions.invoke('send-absence-notifications');
    
    if (error) {
      console.error('Error calling send-absence-notifications:', error);
      throw error;
    }

    console.log('Scheduled notification check completed:', data);

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Scheduled notification check completed',
      result: data 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in scheduled notification function:', error);
    
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});