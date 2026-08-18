import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseConfig } from "@/lib/supabase/config";

export function createSupabaseBrowserClient() {
  const { supabaseKey, supabaseUrl } = getSupabaseConfig();

  return createBrowserClient(supabaseUrl, supabaseKey);
}
