import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function verifyManagerSession(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {},
      },
    }
  );

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { isAuthorized: false, user: null, error: 'Non authentifié' };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'manager') {
    return { isAuthorized: false, user, error: 'Accès réservé aux responsables' };
  }

  return { isAuthorized: true, user, error: null };
}

// GET /api/manager/cashiers - List all cashiers
export async function GET(request: NextRequest) {
  const auth = await verifyManagerSession(request);
  if (!auth.isAuthorized) {
    return NextResponse.json({ error: auth.error }, { status: 403 });
  }

  const adminClient = getAdminClient();

  // Fetch cashier profiles
  const { data: profiles, error: profileErr } = await adminClient
    .from('profiles')
    .select('id, full_name, phone, role, created_at, is_active')
    .eq('role', 'cashier')
    .order('created_at', { ascending: false });

  if (profileErr) {
    return NextResponse.json({ error: profileErr.message }, { status: 500 });
  }

  // Get user details (email, last sign in) from auth.admin
  const { data: authUsers, error: usersErr } = await adminClient.auth.admin.listUsers({
    perPage: 1000,
  });

  const authUserMap = new Map();
  if (!usersErr && authUsers?.users) {
    authUsers.users.forEach((u) => {
      authUserMap.set(u.id, {
        email: u.email,
        last_sign_in_at: u.last_sign_in_at,
        email_confirmed_at: u.email_confirmed_at,
      });
    });
  }

  const cashiers = (profiles || []).map((p) => {
    const authData = authUserMap.get(p.id) || {};
    return {
      ...p,
      email: authData.email || '—',
      last_sign_in_at: authData.last_sign_in_at || null,
      email_confirmed_at: authData.email_confirmed_at || null,
    };
  });

  return NextResponse.json({ cashiers });
}

// POST /api/manager/cashiers - Create a new cashier account
export async function POST(request: NextRequest) {
  const auth = await verifyManagerSession(request);
  if (!auth.isAuthorized) {
    return NextResponse.json({ error: auth.error }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { fullName, email, phone, password } = body;

    if (!fullName || !email || !password) {
      return NextResponse.json(
        { error: 'Le nom, email et mot de passe sont obligatoires' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Le mot de passe doit comporter au moins 6 caractères' },
        { status: 400 }
      );
    }

    const adminClient = getAdminClient();

    // 1. Create User in auth.users
    const { data: authUser, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        phone: phone || '',
        role: 'cashier',
      },
    });

    if (createErr) {
      return NextResponse.json({ error: createErr.message }, { status: 400 });
    }

    const newUserId = authUser.user.id;

    // 2. Ensure profile exists and has role 'cashier'
    const { error: profileUpsertErr } = await adminClient
      .from('profiles')
      .upsert({
        id: newUserId,
        full_name: fullName,
        phone: phone || null,
        role: 'cashier',
        is_active: true,
      });

    if (profileUpsertErr) {
      return NextResponse.json({ error: profileUpsertErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      cashier: {
        id: newUserId,
        full_name: fullName,
        email,
        phone: phone || null,
        role: 'cashier',
        is_active: true,
        created_at: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erreur serveur' }, { status: 500 });
  }
}

// PATCH /api/manager/cashiers - Update cashier details or status
export async function PATCH(request: NextRequest) {
  const auth = await verifyManagerSession(request);
  if (!auth.isAuthorized) {
    return NextResponse.json({ error: auth.error }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { cashierId, fullName, phone, isActive, password } = body;

    if (!cashierId) {
      return NextResponse.json({ error: 'Identifiant du caissier manquant' }, { status: 400 });
    }

    const adminClient = getAdminClient();

    const updates: any = {};
    if (typeof fullName === 'string') updates.full_name = fullName;
    if (typeof phone === 'string') updates.phone = phone;
    if (typeof isActive === 'boolean') updates.is_active = isActive;

    if (Object.keys(updates).length > 0) {
      const { error: updateProfileErr } = await adminClient
        .from('profiles')
        .update(updates)
        .eq('id', cashierId);

      if (updateProfileErr) {
        return NextResponse.json({ error: updateProfileErr.message }, { status: 500 });
      }
    }

    // Optional password reset
    if (password && password.length >= 6) {
      const { error: updateAuthErr } = await adminClient.auth.admin.updateUserById(cashierId, {
        password,
      });

      if (updateAuthErr) {
        return NextResponse.json({ error: updateAuthErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erreur serveur' }, { status: 500 });
  }
}

// DELETE /api/manager/cashiers - Delete a cashier account
export async function DELETE(request: NextRequest) {
  const auth = await verifyManagerSession(request);
  if (!auth.isAuthorized) {
    return NextResponse.json({ error: auth.error }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const cashierId = searchParams.get('id');

    if (!cashierId) {
      return NextResponse.json({ error: 'Identifiant manquant' }, { status: 400 });
    }

    const adminClient = getAdminClient();

    // Delete user from auth (cascades to profile)
    const { error: deleteErr } = await adminClient.auth.admin.deleteUser(cashierId);

    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erreur serveur' }, { status: 500 });
  }
}

