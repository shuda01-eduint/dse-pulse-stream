import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "admin" | "moderator" | "user";

interface UseUserRoleResult {
  role: AppRole | null;
  isAdmin: boolean;
  isLoading: boolean;
  userId: string | null;
}

export function useUserRole(): UseUserRoleResult {
  const [role, setRole] = useState<AppRole | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchUserRole() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.user?.id) {
          if (isMounted) {
            setRole(null);
            setUserId(null);
            setIsLoading(false);
          }
          return;
        }

        if (isMounted) {
          setUserId(session.user.id);
        }

        // Fetch role from user_roles table
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .maybeSingle();

        if (error) {
          console.error("Error fetching user role:", error.message);
          if (isMounted) {
            setRole(null);
            setIsLoading(false);
          }
          return;
        }

        if (isMounted) {
          setRole(data?.role as AppRole ?? null);
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Error in fetchUserRole:", error);
        if (isMounted) {
          setRole(null);
          setIsLoading(false);
        }
      }
    }

    fetchUserRole();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_OUT") {
          if (isMounted) {
            setRole(null);
            setUserId(null);
            setIsLoading(false);
          }
        } else if (session?.user?.id) {
          fetchUserRole();
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return {
    role,
    isAdmin: role === "admin",
    isLoading,
    userId,
  };
}
