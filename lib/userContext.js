import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from './supabaseClient';

const UserContext = createContext();

async function loadOrCreateProfile(sessionUser) {
  const userId = sessionUser.id;

  const { data: existing, error: readError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (readError) {
    console.error('UserContext: profile read failed:', readError.message);
    return null;
  }

  if (existing) {
    return existing;
  }

  const payload = {
    id: userId,
    email: sessionUser.email ?? '',
    full_name: sessionUser.user_metadata?.full_name || '',
    phone: '',
  };

  const { data: created, error: insertError } = await supabase
    .from('profiles')
    .insert([payload])
    .select('*')
    .single();

  if (!insertError && created) {
    return created;
  }

  if (insertError) {
    const { data: raced, error: retryError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (!retryError && raced) {
      return raced;
    }

    console.error('UserContext: profile insert failed:', insertError.message);
    if (retryError) {
      console.error('UserContext: profile re-read failed:', retryError.message);
    }
  }

  return null;
}

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    async function applySession(session) {
      if (!session?.user) {
        if (!mountedRef.current) return;
        setUser(null);
        setProfile(null);
        return;
      }

      const sessionUser = session.user;
      if (!mountedRef.current) return;
      setUser(sessionUser);

      try {
        const profileRow = await loadOrCreateProfile(sessionUser);
        if (!mountedRef.current) return;
        setProfile(profileRow);
      } catch (err) {
        console.error('UserContext: profile load failed:', err?.message || err);
        if (!mountedRef.current) return;
        setProfile(null);
      }
    }

    async function getSession() {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('UserContext: session error:', sessionError.message);
          if (!mountedRef.current) return;
          setUser(null);
          setProfile(null);
          return;
        }

        await applySession(session);
      } catch (err) {
        console.error('UserContext: getSession failed:', err?.message || err);
        if (!mountedRef.current) return;
        setUser(null);
        setProfile(null);
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    }

    void getSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void (async () => {
        try {
          await applySession(session);
        } catch (err) {
          console.error('UserContext: onAuthStateChange handler failed:', err?.message || err);
          if (!mountedRef.current) return;
          if (!session?.user) {
            setUser(null);
            setProfile(null);
          }
        }
      })();
    });

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <UserContext.Provider value={{ user, profile, loading }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
