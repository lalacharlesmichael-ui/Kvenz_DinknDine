import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { normalizeUsername, usernameToAuthEmail } from "@/lib/auth/username";

type RegisterRequest = {
  fullName?: string;
  password?: string;
  phone?: string;
  username?: string;
};

function getAdminSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function POST(request: Request) {
  const supabase = getAdminSupabaseClient();

  if (!supabase) {
    return NextResponse.json(
      {
        error:
          "Registration is not configured yet. Add SUPABASE_SERVICE_ROLE_KEY on the server, then restart the app.",
      },
      { status: 503 },
    );
  }

  const body = (await request.json()) as RegisterRequest;
  const username = normalizeUsername(body.username ?? "");
  const fullName = body.fullName?.trim() ?? "";
  const phone = body.phone?.trim() ?? "";
  const password = body.password ?? "";

  let authEmail = "";

  try {
    authEmail = usernameToAuthEmail(username);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Please enter a valid username.",
      },
      { status: 400 },
    );
  }

  if (fullName.length === 0) {
    return NextResponse.json(
      { error: "Full name is required." },
      { status: 400 },
    );
  }

  if (password.length < 6) {
    return NextResponse.json(
      { error: "Password should be at least 6 characters." },
      { status: 400 },
    );
  }

  const { data: existingProfile, error: existingProfileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (existingProfileError) {
    return NextResponse.json(
      { error: existingProfileError.message },
      { status: 400 },
    );
  }

  if (existingProfile) {
    return NextResponse.json(
      { error: "That username is already registered. Please login instead." },
      { status: 409 },
    );
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: authEmail,
    email_confirm: true,
    password,
    user_metadata: {
      full_name: fullName,
      phone,
      username,
    },
  });

  if (error || !data.user) {
    const message = error?.message ?? "Unable to create account.";
    const status =
      message.toLowerCase().includes("already") ||
      message.toLowerCase().includes("registered")
        ? 409
        : 400;

    return NextResponse.json({ error: message }, { status });
  }

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      auth_email: authEmail,
      full_name: fullName,
      id: data.user.id,
      phone,
      username,
    },
    { onConflict: "id" },
  );

  if (profileError) {
    return NextResponse.json(
      { error: profileError.message },
      { status: 400 },
    );
  }

  return NextResponse.json(
    {
      user: {
        fullName,
        role: "player",
        username,
      },
    },
    { status: 201 },
  );
}
