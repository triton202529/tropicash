// lib/userContext.js
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('Session fetch error:', sessionError.message);
        setLoading(false);
        return;
      }

      const currentUser = session?.user;
      setUser(currentUser);

      if (!currentUser) {
        setLoading(false);
        return;
      }

      try {
        // Check if profile exists
        const { data: existing, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUser.id);

        if (profileError) throw profileError;

        if (!existing || existing.length === 0) {
          // Create profile if missing
          const { error: insertError } = await supabase.from('profiles').insert([
            {
              id: currentUser.id,
              full_name: currentUser.user_metadata?.full_name || '',
              email: currentUser.email,
              phone: '',
            },
          ]);

          if (insertError) throw insertError;

          console.log('✅ New profile created');
        } else {
          console.log('✅ Profile exists');
        }

        // Fetch profile
        const { data: fetchedProfile, error: fetchError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUser.id)
          .single();

        if (fetchError) throw fetchError;

        setProfile(fetchedProfile);
      } catch (err) {
        console.error('UserContext error:', err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  return (
    <UserContext.Provider value={{ user, profile, loading }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
