// lib/userContext.js
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from './supabaseClient';

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const sessionSeqRef = useRef(0);

  useEffect(() => {
    async function hydrateFromSession(session) {
      const seq = ++sessionSeqRef.current;
      const stale = () => seq !== sessionSeqRef.current;

      setLoading(true);

      if (!session?.user) {
        if (stale()) return;
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      const currentUser = session.user;
      if (stale()) return;
      setUser(currentUser);

      try {
        const { data: existing, error: readError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUser.id)
          .maybeSingle();

        if (stale()) return;

        if (readError) {
          console.error('UserContext: profile read failed:', readError.message);
          if (stale()) return;
          setProfile(null);
          return;
        }

        let profileRow = existing;

        if (!profileRow) {
          const payload = {
            id: currentUser.id,
            email: currentUser.email ?? '',
            full_name: currentUser.user_metadata?.full_name || '',
            phone: '',
          };

          const { data: created, error: insertError } = await supabase
            .from('profiles')
            .insert([payload])
            .select('*')
            .single();

          if (stale()) return;

          if (insertError) {
            const { data: raced, error: retryError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', currentUser.id)
              .maybeSingle();

            if (stale()) return;

            if (retryError) {
              console.error('UserContext: profile insert failed:', insertError.message);
              console.error('UserContext: profile re-read failed:', retryError.message);
              if (stale()) return;
              setProfile(null);
              return;
            }

            if (!raced) {
              console.error('UserContext: profile insert failed:', insertError.message);
              if (stale()) return;
              setProfile(null);
              return;
            }

            profileRow = raced;
          } else {
            profileRow = created;
          }
        }

        if (stale()) return;
        setProfile(profileRow);
      } catch (err) {
        console.error(
          'UserContext: unexpected error while loading profile:',
          err?.message || err
        );
        if (stale()) return;
        setProfile(null);
      } finally {
        if (!stale()) {
          setLoading(false);
        }
      }
    }

    async function init() {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('UserContext: session error:', sessionError.message);
        sessionSeqRef.current += 1;
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      await hydrateFromSession(session);
    }

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      hydrateFromSession(session);
    });

    return () => {
      subscription.unsubscribe();
      sessionSeqRef.current += 1;
    };
  }, []);

  return (
    <UserContext.Provider value={{ user, profile, loading }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
