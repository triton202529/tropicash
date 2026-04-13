// lib/setupUserProfile.js
import { supabase } from './supabaseClient';

export const setupUserProfile = async () => {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.user) {
    console.warn('No session found');
    return;
  }

  const user = session.user;

  // Check if profile exists
  const { data: existingProfiles, error: fetchError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id);

  if (fetchError) {
    console.error('Error checking profile:', fetchError.message);
    return;
  }

  if (existingProfiles.length === 0) {
    // No profile found, create one
    const { error: insertError } = await supabase.from('profiles').insert([
      {
        id: user.id,
        full_name: user.user_metadata.full_name || '',
        email: user.email,
        phone: '', // Add logic to collect/set phone later
      },
    ]);

    if (insertError) {
      console.error('Error creating profile:', insertError.message);
    } else {
      console.log('✅ Profile created successfully');
    }
  } else {
    console.log('✅ Profile already exists');
  }
};
