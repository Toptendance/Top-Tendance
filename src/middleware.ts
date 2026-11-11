import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // 1. Unauthenticated users cannot access /account, /pos, /inventory, /reports
  if (!user) {
    if (
      pathname.startsWith('/account') ||
      pathname.startsWith('/pos') ||
      pathname.startsWith('/inventory') ||
      pathname.startsWith('/reports')
    ) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('redirectTo', pathname);
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // 2. Role-based routing checks for authenticated users
  if (
    pathname.startsWith('/pos') ||
    pathname.startsWith('/inventory') ||
    pathname.startsWith('/reports')
  ) {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    // If the profiles fetch fails (DB timeout, network error), redirect to login
    if (profileError || !profile) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }

    const userRole = profile.role;

    // /inventory and /reports require manager role
    if (pathname.startsWith('/inventory') || pathname.startsWith('/reports')) {
      if (userRole !== 'manager') {
        const url = request.nextUrl.clone();
        url.pathname = userRole === 'cashier' ? '/pos' : '/account';
        return NextResponse.redirect(url);
      }
    }

    // /pos requires cashier or manager role
    if (pathname.startsWith('/pos')) {
      if (userRole !== 'cashier' && userRole !== 'manager') {
        const url = request.nextUrl.clone();
        url.pathname = '/account';
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/account/:path*',
    '/pos/:path*',
    '/inventory/:path*',
    '/reports/:path*',
  ],
};

